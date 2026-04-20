'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export interface UserInfo {
  id: string;
  email: string;
  role: 'customer' | 'dealer' | 'admin';
  discountPct: number;
  company: string | null;
}

interface UserContextValue {
  user: UserInfo | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function useUser(): UserContextValue {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (cancelled || !authUser) { setLoading(false); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, discount_pct, company')
          .eq('id', authUser.id)
          .single();

        if (cancelled) return;

        const role = (profile?.role === 'dealer' || profile?.role === 'admin')
          ? profile.role
          : 'customer' as const;

        setUser({
          id: authUser.id,
          email: authUser.email ?? '',
          role,
          discountPct: profile?.discount_pct ?? 0,
          company: profile?.company ?? null,
        });
      } catch {
        // Session abgelaufen oder Netzwerkfehler — als Gast behandeln
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.refresh();
  }, [router]);

  return (
    <UserContext.Provider value={{ user, loading, logout }}>
      {children}
    </UserContext.Provider>
  );
}
