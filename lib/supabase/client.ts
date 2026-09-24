'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client, for the login page (magic-link sign-in)
// and any client component that needs the current session.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
