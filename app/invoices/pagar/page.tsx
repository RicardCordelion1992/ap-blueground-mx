import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import MarkPaidButton from '../[id]/MarkPaidButton';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const invoices = await prisma.invoice.findMany({
    where: { status: 'APPROVED' },
    include: { vendor: true, category: true, allocations: { include: { building: true } } },
    orderBy: { dueDate: 'asc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Por pagar</h1>
        <p className="text-sm text-gray-500">Facturas aprobadas, en espera de pago</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Edificio(s)</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Vencimiento</th>
              <th className="px-4 py-2 font-medium">Acción</th>
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
                <td className="px-4 py-2 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-MX') : '—'}</td>
                <td className="px-4 py-2">
                  <MarkPaidButton invoiceId={inv.id} disabled={!inv.payable} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No hay facturas aprobadas en espera de pago.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
