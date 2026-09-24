import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const from = searchParams.from ? new Date(searchParams.from) : undefined;
  const to = searchParams.to ? new Date(searchParams.to) : undefined;

  const allocations = await prisma.invoiceAllocation.findMany({
    where: { invoice: { receivedDate: { gte: from, lte: to } } },
    include: { building: true, unit: true },
  });

  const total = allocations.reduce((s, a) => s + Number(a.amount), 0);

  const byBuilding = new Map<string, { name: string; amount: number }>();
  const byUnit = new Map<string, { buildingName: string; unitNumber: string; poCode: string | null; amount: number }>();

  for (const a of allocations) {
    const amt = Number(a.amount);
    const b = byBuilding.get(a.buildingId) || { name: a.building.name, amount: 0 };
    b.amount += amt;
    byBuilding.set(a.buildingId, b);

    if (a.unitId && a.unit) {
      const u = byUnit.get(a.unitId) || { buildingName: a.building.name, unitNumber: a.unit.unitNumber, poCode: a.unit.poCode, amount: 0 };
      u.amount += amt;
      byUnit.set(a.unitId, u);
    }
  }

  const buildingRows = [...byBuilding.values()].sort((a, b) => b.amount - a.amount);
  const unitRows = [...byUnit.values()].sort((a, b) => b.amount - a.amount);

  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Reportes</h1>
        <p className="text-sm text-gray-500">Fragmentación por edificio y por unidad — % calculado en vivo, nunca almacenado</p>
      </div>

      <form className="flex gap-2 items-end" method="get">
        <div>
          <label className="label">Desde</label>
          <input type="date" name="from" defaultValue={searchParams.from} className="input" />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input type="date" name="to" defaultValue={searchParams.to} className="input" />
        </div>
        <button className="btn-secondary">Filtrar</button>
      </form>

      <div className="card p-4">
        <p className="text-sm text-gray-500">Total asignado</p>
        <p className="text-2xl font-semibold">{fmt(total)}</p>
      </div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-sm">Por edificio</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Edificio</th>
              <th className="px-4 py-2 font-medium">Monto</th>
              <th className="px-4 py-2 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {buildingRows.map((b) => (
              <tr key={b.name} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">{b.name}</td>
                <td className="px-4 py-2">{fmt(b.amount)}</td>
                <td className="px-4 py-2 text-gray-600">{pct(b.amount)}</td>
              </tr>
            ))}
            {buildingRows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  Sin datos en el rango seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-sm">Por unidad (depa / PO)</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Edificio</th>
              <th className="px-4 py-2 font-medium">Depa</th>
              <th className="px-4 py-2 font-medium">PO</th>
              <th className="px-4 py-2 font-medium">Monto</th>
              <th className="px-4 py-2 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {unitRows.map((u, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">{u.buildingName}</td>
                <td className="px-4 py-2">{u.unitNumber}</td>
                <td className="px-4 py-2 text-gray-600">{u.poCode || '—'}</td>
                <td className="px-4 py-2">{fmt(u.amount)}</td>
                <td className="px-4 py-2 text-gray-600">{pct(u.amount)}</td>
              </tr>
            ))}
            {unitRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Sin facturas asignadas a una unidad específica todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
