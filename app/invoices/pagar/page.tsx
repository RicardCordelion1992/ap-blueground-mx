import { prisma } from '@/lib/prisma';
import { periodLabel } from '@/lib/periodLabel';
import PagarTable from './PagarTable';

export const dynamic = 'force-dynamic';

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(d: Date) {
  const mes = MESES[d.getUTCMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getUTCFullYear()}`;
}

export default async function PaymentsPage() {
  const [invoices, buildings, categories] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: 'APPROVED' },
      include: { vendor: true, category: true, allocations: { include: { building: true } } },
      orderBy: { dueDate: 'asc' },
      take: 2000,
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
    monthKey: monthKey(inv.receivedDate),
    monthLabel: monthLabel(inv.receivedDate),
  }));

  const buildingOptions = buildings.map((b) => b.name);
  const categoryOptions = categories.map((c) => c.name);

  const monthMap = new Map<string, string>();
  for (const r of rows) monthMap.set(r.monthKey, r.monthLabel);
  const monthOptions = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, label]) => ({ key, label }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Por pagar</h1>
        <p className="text-sm text-gray-500">Facturas aprobadas, en espera de pago</p>
      </div>

      <PagarTable invoices={rows} buildingOptions={buildingOptions} categoryOptions={categoryOptions} monthOptions={monthOptions} />
    </div>
  );
}
