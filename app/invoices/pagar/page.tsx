import { prisma } from '@/lib/prisma';
import { periodLabel } from '@/lib/periodLabel';
import PagarTable from './PagarTable';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const [invoices, buildings, categories] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: 'APPROVED' },
      include: { vendor: true, category: true, allocations: { include: { building: true } } },
      orderBy: { dueDate: 'asc' },
      take: 100,
    }),
    prisma.building.findMany({ orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const rows = invoices.map((inv) => ({
    id: inv.id,
    vendorName: inv.vendor.name,
    categoryName: inv.category?.name || null,
    periodLabel: periodLabel(inv.billingStart, inv.billingEnd),
    buildingLabel:
      inv.allocations.length > 1 ? `${inv.allocations.length} edificios` : inv.allocations[0]?.building.name || '—',
    buildingNames: inv.allocations.map((a) => a.building.name),
    total: Number(inv.total),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    payable: inv.payable,
  }));

  const buildingOptions = buildings.map((b) => b.name);
  const categoryOptions = categories.map((c) => c.name);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Por pagar</h1>
        <p className="text-sm text-gray-500">Facturas aprobadas, en espera de pago</p>
      </div>

      <PagarTable invoices={rows} buildingOptions={buildingOptions} categoryOptions={categoryOptions} />
    </div>
  );
}
