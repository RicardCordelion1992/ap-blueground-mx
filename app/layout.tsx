import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import AccessDenied from '@/components/AccessDenied';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/currentUser';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Cuentas por Pagar · Blueground México',
  description: 'Captura, clasificación y reporteo de facturas y proveedores',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const appUser = authUser ? await getCurrentUser() : null;

  // Un CARDHOLDER (tarjetahabiente dado de alta solo para subir sus gastos de tarjeta) solo
  // puede estar en /gastos-tarjeta — cualquier otra ruta lo regresa ahí, sin importar si llega
  // por el menú o escribiendo la URL directamente. El pathname llega vía el header que pone
  // lib/supabase/middleware.ts en cada request (edge-safe: ahí no se puede usar Prisma).
  if (appUser?.role === 'CARDHOLDER') {
    const pathname = headers().get('x-pathname') || '';
    if (!pathname.startsWith('/gastos-tarjeta')) {
      redirect('/gastos-tarjeta');
    }
  }

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
