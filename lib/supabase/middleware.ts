import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase session on every request and enforces one rule:
// every page except /login, /auth and /forgot-password requires a session.
// /forgot-password has to be reachable with no session (that's the whole
// point — you've lost access), but /reset-password is NOT on this list:
// you only reach it after the real recovery-email link exchanges a code
// for a session in /auth/callback, so it stays protected like every other
// page. Who is allowed to have an account at all is controlled separately,
// by which users an ADMIN has pre-provisioned from /usuarios (see
// lib/currentUser.ts) — not by email domain.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith('/login') || path.startsWith('/auth') || path.startsWith('/forgot-password');

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}
