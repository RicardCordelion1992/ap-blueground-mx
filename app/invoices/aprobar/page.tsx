import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import AprobarTable from './AprobarTable';

export const dynamic = 'force-dynamic';

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(d: Date) {
  const mes = MESES[d.getUTCMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getUTCFullYear()}`;
}

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  const canApprove = user?.role === 'ADMIN';

  const [invoices, buildings, categories] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: 'PENDING' },
      include: { vendor: true, category: true, allocations: { include: { building: true } } },
      orderBy: { receivedDate: 'asc' },
      take: 2000,
    }),
    prisma.building.findMany({ orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  const rows = invoices.map((inv) => ({
    id: inv.id,
    vendorName: inv.vendor.name,
    categoryName: inv.category?.name || null,
    buildingLabel:
      inv.allocations.length > 1 ? `${inv.allocations.length} edificios` : inv.allocations[0]?.building.name || '—',
    buildingNames: inv.allocations.map((a) => a.building.name),
    total: Number(inv.total),
    receivedDate: inv.receivedDate.toISOString(),
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
        <h1 className="text-xl font-semibold">Aprobar facturas</h1>
        <p className="text-sm text-gray-500">Facturas capturadas, en espera de aprobación</p>
      </div>

      {!canApprove && (
        <div className="card p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200">
          Solo un administrador puede aprobar o rechazar facturas. Puedes ver la lista, pero los botones estarán
          deshabilitados.
        </div>
      )}

      <AprobarTable
        invoices={rows}
        canApprove={canApprove}
        buildingOptions={buildingOptions}
        categoryOptions={categoryOptions}
        monthOptions={monthOptions}
      />
    </div>
  );
}
