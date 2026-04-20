import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifyAdminToken, COOKIE_NAME } from '@/lib/admin-auth'
import { rateLimit } from '@/lib/rate-limit'

// Rate-Limit-Konfiguration: Route-Prefix → [Limit, Fenster in ms]
const RATE_LIMITS: Record<string, [number, number]> = {
  '/api/orders':       [5,  60_000],      // 5/min — Bestellungen
  '/api/config/save':  [10, 60_000],      // 10/min — Config speichern
  '/api/admin/auth':   [10, 15 * 60_000], // 10/15min — Admin-Login
  '/api/offer':        [10, 60_000],      // 10/min — PDF-Angebote
  '/api/':             [60, 60_000],      // 60/min — alle anderen API-Routen
}

/** IP aus Request ermitteln (Vercel setzt x-forwarded-for) */
function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '0.0.0.0'
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // AR-Vorschau, Config-Load und statische Assets offen zugänglich
  const isPublicRoute = path.startsWith('/ar')
    || path.startsWith('/api/config/load')
    || path.startsWith('/models/')       // GLB-3D-Modelle (für AR-Viewer)

  if (!isPublicRoute) {
    const expectedUser = process.env.BETA_USER ?? 'lightmodul'
    const expectedPass = process.env.BETA_PASSWORD ?? ''

    if (!expectedPass) {
      // Kein Passwort gesetzt → Zugang blockieren (Fail-Safe)
      return new NextResponse('Server nicht konfiguriert', { status: 503 })
    }

    const auth = req.headers.get('authorization') ?? ''
    const expected = 'Basic ' + btoa(`${expectedUser}:${expectedPass}`)

    if (auth !== expected) {
      return new NextResponse('Zugang verweigert', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Lightmodul Konfigurator", charset="UTF-8"',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    }
  }

  // Rate Limiting für API-Routen

  if (path.startsWith('/api/')) {
    const ip = getClientIp(req)
    // Spezifischste Regel zuerst finden
    const match = Object.entries(RATE_LIMITS).find(([prefix]) => path.startsWith(prefix))
    if (match) {
      const [prefix, [limit, windowMs]] = match
      const { allowed, remaining } = rateLimit(`${prefix}:${ip}`, limit, windowMs)
      if (!allowed) {
        return NextResponse.json(
          { error: 'Zu viele Anfragen — bitte warten Sie einen Moment.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(windowMs / 1000)),
              'X-RateLimit-Remaining': '0',
            },
          },
        )
      }
      // Verbleibende Anfragen als Header (informativ)
      req.headers.set('x-ratelimit-remaining', String(remaining))
    }
  }

  // Admin-Schutz: /admin/* und /api/admin/* (außer Login-Routen)
  const isAdminRoute = path.startsWith('/admin') || path.startsWith('/api/admin')
  const isAdminLoginPage = path === '/admin/login'
  const isAdminLoginApi = path === '/api/admin/auth/login'

  if (isAdminRoute && !isAdminLoginPage && !isAdminLoginApi) {
    const adminPass = process.env.ADMIN_PASSWORD ?? ''
    if (!adminPass) {
      return new NextResponse('Admin nicht konfiguriert', { status: 503 })
    }

    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token || !(await verifyAdminToken(token))) {
      if (path.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }

  // Dealer-Routen: nur fuer eingeloggte Nutzer mit role=dealer|admin
  const isDealerRoute = path.startsWith('/dealer');

  if (isDealerRoute) {
    const checkSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {
            // Keine Cookies setzen in diesem Check
          },
        },
      },
    );

    const { data: { user } } = await checkSupabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Supabase-Session bei jedem Request erneuern (verhindert ungewolltes Ausloggen)
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Session-Token erneuern (wichtig für persistente Anmeldung)
  await supabase.auth.getUser()

  return res
}

export const config = {
  matcher: [
    // Alle Routen außer Next.js-Interna und statische Assets
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
}
