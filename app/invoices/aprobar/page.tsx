import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import AprobarTable from './AprobarTable';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  const canApprove = user?.role === 'ADMIN';

  const [invoices, buildings, categories] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: 'PENDING' },
      include: { vendor: true, category: true, allocations: { include: { building: true } } },
      orderBy: { receivedDate: 'asc' },
      take: 100,
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
  }));

  const buildingOptions = buildings.map((b) => b.name);
  const categoryOptions = categories.map((c) => c.name);

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

      <AprobarTable invoices={rows} canApprove={canApprove} buildingOptions={buildingOptions} categoryOptions={categoryOptions} />
    </div>
  );
}
