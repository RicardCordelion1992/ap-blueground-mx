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
    <header className="bg-brand-700">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <img src="/brand/blueground-logo-white.png" alt="Blueground" className="h-5 w-auto shrink-0" />
          <span className="hidden md:inline text-xs font-medium text-brand-200 border-l border-brand-500 pl-4">
            Cuentas por Pagar
          </span>
          <nav className="flex gap-1 flex-wrap">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? 'bg-accent-500 text-brand-800'
                    : 'text-brand-100 hover:bg-brand-600'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-brand-200">
          <span className="hidden sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
