import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({ searchParams }: { searchParams: { status?: string } }) {
  const invoices = await prisma.invoice.findMany({
    where: { status: searchParams.status as any },
    include: { vendor: true, category: true, allocations: { include: { building: true } } },
    orderBy: { receivedDate: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Facturas</h1>
          <p className="text-sm text-gray-500">Captura y clasificación</p>
        </div>
        <Link href="/invoices/new" className="btn-primary">
          + Nueva factura
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        <Link href="/invoices" className={`px-3 py-1.5 rounded-md ${!searchParams.status ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>Todas</Link>
        <Link href="/invoices?status=PENDING" className={`px-3 py-1.5 rounded-md ${searchParams.status === 'PENDING' ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>Pendientes</Link>
        <Link href="/invoices?status=PAID" className={`px-3 py-1.5 rounded-md ${searchParams.status === 'PAID' ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>Pagadas</Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Edificio(s)</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Recibida</th>
              <th className="px-4 py-2 font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline font-medium">
                    {inv.vendor.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{inv.category?.name || '—'}</td>
                <td className="px-4 py-2 text-gray-600">
                  {inv.allocations.length > 1
                    ? `${inv.allocations.length} edificios`
                    : inv.allocations[0]?.building.name || '—'}
                </td>
                <td className="px-4 py-2">${Number(inv.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-2 text-gray-500">{new Date(inv.receivedDate).toLocaleDateString('es-MX')}</td>
                <td className="px-4 py-2">
                  {inv.status === 'PAID' ? (
                    <span className="badge bg-gray-100 text-gray-700">Pagada</span>
                  ) : inv.payable ? (
                    <span className="badge-ready">Pagable</span>
                  ) : (
                    <span className="badge-incomplete">No pagable</span>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Sin facturas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
