import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Días hacia adelante que cuentan como "próxima a vencer" en el panel — suficiente para
// tenerlas en cuenta al armar la corrida de pagos del mes.
const DUE_SOON_DAYS = 15;

export default async function DashboardPage() {
  const [pendingCount, incompleteVendors, monthTotalAgg, readyVendors, totalVendors] = await Promise.all([
    prisma.invoice.count({ where: { status: 'PENDING' } }),
    prisma.vendor.count({ where: { readiness: 'INCOMPLETE' } }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { receivedDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
    }),
    prisma.vendor.count({ where: { readiness: 'READY' } }),
    prisma.vendor.count(),
  ]);

  const notPayable = await prisma.invoice.count({ where: { status: 'PENDING', payable: false } });

  const recentInvoices = await prisma.invoice.findMany({
    take: 8,
    orderBy: { receivedDate: 'desc' },
    include: { vendor: true, allocations: { include: { building: true } } },
  });

  // Facturas aprobadas, en espera de pago, cuyo vencimiento ya pasó o está a la vuelta de la
  // esquina — agrupadas por proveedor para poder armar la corrida de pagos del mes de un vistazo
  // sin tener que ir a revisar "Pagar" factura por factura.
  const dueSoonHorizon = new Date();
  dueSoonHorizon.setDate(dueSoonHorizon.getDate() + DUE_SOON_DAYS);
  const dueSoonInvoices = await prisma.invoice.findMany({
    where: { status: 'APPROVED', dueDate: { not: null, lte: dueSoonHorizon } },
    include: { vendor: true },
    orderBy: { dueDate: 'asc' },
    take: 100,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueSoonByVendor = new Map<string, { vendorName: string; invoices: { id: string; total: number; dueDate: Date; daysLeft: number }[] }>();
  for (const inv of dueSoonInvoices) {
    const dueDate = inv.dueDate as Date;
    const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    const group = dueSoonByVendor.get(inv.vendorId) || { vendorName: inv.vendor.name, invoices: [] };
    group.invoices.push({ id: inv.id, total: Number(inv.total), dueDate, daysLeft });
    dueSoonByVendor.set(inv.vendorId, group);
  }
  const dueSoonGroups = [...dueSoonByVendor.values()].sort((a, b) => a.invoices[0].daysLeft - b.invoices[0].daysLeft);
  const overdueCount = dueSoonInvoices.filter((inv) => (inv.dueDate as Date) < today).length;

  const stats = [
    { label: 'Facturas pendientes', value: pendingCount },
    { label: 'Total capturado (mes)', value: `$${Number(monthTotalAgg._sum.total ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` },
    { label: 'Proveedores listos ("Ready")', value: `${readyVendors} / ${totalVendors}` },
    { label: 'Facturas no pagables (proveedor incompleto)', value: notPayable, alert: notPayable > 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Panel</h1>
        <p className="text-sm text-gray-500">Resumen de cuentas por pagar</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`card p-4 ${s.alert ? 'border-amber-300 bg-amber-50' : ''}`}>
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {incompleteVendors > 0 && (
        <div className="card p-4 border-amber-300 bg-amber-50 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            <strong>{incompleteVendors}</strong> proveedor(es) con documentación incompleta — sus facturas no se marcan como pagables hasta completar su expediente AML/KYC.
          </p>
          <Link href="/vendors?readiness=INCOMPLETE" className="btn-secondary text-xs whitespace-nowrap">
            Ver proveedores
          </Link>
        </div>
      )}

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-sm">Facturas próximas a vencer (por proveedor)</h2>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && <span className="badge-incomplete text-xs">{overdueCount} vencida(s)</span>}
            <Link href="/invoices/pagar" className="btn-secondary text-xs whitespace-nowrap">
              Ir a Pagar
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {dueSoonGroups.map((g) => (
            <div key={g.vendorName} className="px-4 py-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{g.vendorName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {g.invoices.length} factura(s) ·{' '}
                  {g.invoices
                    .map(
                      (inv) =>
                        `${inv.dueDate.toLocaleDateString('es-MX')} (${
                          inv.daysLeft < 0 ? `vencida hace ${Math.abs(inv.daysLeft)}d` : inv.daysLeft === 0 ? 'vence hoy' : `en ${inv.daysLeft}d`
                        })`
                    )
                    .join(', ')}
                </p>
              </div>
              <p className="text-sm font-medium whitespace-nowrap">
                ${g.invoices.reduce((s, inv) => s + inv.total, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
          {dueSoonGroups.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">
              Sin facturas aprobadas por vencer en los próximos {DUE_SOON_DAYS} días.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-sm">Facturas recientes</h2>
          <Link href="/invoices/new" className="btn-primary text-xs">
            + Nueva factura
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Edificio(s)</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Recibida</th>
              <th className="px-4 py-2 font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {recentInvoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline">
                    {inv.vendor.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{inv.allocations.map((a) => a.building.name).join(', ')}</td>
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
            {recentInvoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Aún no hay facturas capturadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
