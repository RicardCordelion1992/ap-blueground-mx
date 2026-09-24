'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from './SignOutButton';

const LINKS = [
  { href: '/', label: 'Panel' },
  { href: '/invoices', label: 'Facturas' },
  { href: '/vendors', label: 'Proveedores' },
  { href: '/buildings', label: 'Edificios' },
  { href: '/reports', label: 'Reportes' },
];

export default function Nav({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const links = role === 'ADMIN' ? [...LINKS, { href: '/usuarios', label: 'Usuarios' }] : LINKS;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-brand-700">Cuentas por Pagar</span>
          <nav className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  pathname === l.href ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
