import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import AccessDenied from '@/components/AccessDenied';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/currentUser';

export const metadata: Metadata = {
  title: 'Cuentas por Pagar · Blueground México',
  description: 'Captura, clasificación y reporteo de facturas y proveedores',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // authUser = has a valid Supabase session. appUser = also has an active,
  // admin-provisioned row in our own User table. An authenticated email
  // without a matching row (or deactivated) sees AccessDenied, not the app.
  const appUser = authUser ? await getCurrentUser() : null;

  return (
    <html lang="es">
      <body>
        {authUser && appUser && <Nav email={authUser.email ?? ''} role={appUser.role} />}
        <main className="max-w-6xl mx-auto px-4 py-6">
          {authUser && !appUser ? <AccessDenied email={authUser.email ?? ''} /> : children}
        </main>
      </body>
    </html>
  );
}
