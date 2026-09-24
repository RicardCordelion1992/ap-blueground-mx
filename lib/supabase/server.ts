import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side Supabase client bound to the current request's cookies.
// Used in Server Components, Route Handlers and Server Actions to read
// the logged-in user's session.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component with no writable cookie store —
            // safe to ignore because middleware refreshes the session.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // see note above
          }
        },
      },
    }
  );
}

// Admin client with the service-role key: bypasses RLS. Only ever used
// server-side (API routes / server actions), never exposed to the browser.
// Needed for Storage uploads and any write the logged-in user's own
// session shouldn't be trusted to do directly (e.g. computing readiness).
import { createClient as createRawClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
