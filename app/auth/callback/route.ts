import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handles both the (now-unused) magic-link callback and the password-
// recovery email link: Supabase sends the browser here with a `code`; we
// exchange it for a session, then continue on to `next` (defaults to the
// app) — forgot-password uses `next=/reset-password` so the user lands on
// the set-new-password screen instead of the dashboard.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const next = req.nextUrl.searchParams.get('next') || '/';
  return NextResponse.redirect(new URL(next, req.url));
}
