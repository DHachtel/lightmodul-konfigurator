import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server-Client — NUR für Server Components, API Routes und Server Actions.
 * NIEMALS in Client Components ('use client') importieren.
 * Darf den service_role key verwenden, falls benötigt.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // In Server Components ohne Response-Kontext ignorierbar
          }
        },
      },
    }
  );
}

/**
 * Service-Role-Client — umgeht RLS vollständig.
 * NUR für serverseitige Operationen auf Daten, die keine Nutzer-Autorisierung
 * benötigen (z.B. öffentliche Preistabelle lesen, Admin-Aktionen).
 * NIEMALS den key an den Client weitergeben oder in Client Components verwenden.
 */
export function createServiceSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
