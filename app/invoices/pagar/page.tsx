import { prisma } from '@/lib/prisma';
import { periodLabel } from '@/lib/periodLabel';
import PagarTable from './PagarTable';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const invoices = await prisma.invoice.findMany({
    where: { status: 'APPROVED' },
    include: { vendor: true, category: true, allocations: { include: { building: true } } },
    orderBy: { dueDate: 'asc' },
    take: 100,
  });

  // Serializamos lo mínimo que necesita el cliente (Decimal/Date no pasan tal cual a un client component).
  const rows = invoices.map((inv) => ({
    id: inv.id,
    vendorName: inv.vendor.name,
    categoryName: inv.category?.name || null,
    periodLabel: periodLabel(inv.billingStart, inv.billingEnd),
    buildingLabel:
      inv.allocations.length > 1 ? `${inv.allocations.length} edificios` : inv.allocations[0]?.building.name || '—',
    total: Number(inv.total),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    payable: inv.payable,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Por pagar</h1>
        <p className="text-sm text-gray-500">Facturas aprobadas, en espera de pago</p>
      </div>

      <PagarTable invoices={rows} />
    </div>
  );
}
