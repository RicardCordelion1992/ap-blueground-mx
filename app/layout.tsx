import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Cuentas por Pagar · Blueground México',
  description: 'Captura, clasificación y reporteo de facturas y proveedores',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="es">
      <body>
        {user && <Nav email={user.email ?? ''} />}
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
