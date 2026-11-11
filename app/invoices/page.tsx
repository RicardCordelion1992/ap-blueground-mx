import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/currentUser';
import { periodLabel } from '@/lib/periodLabel';
import InvoicesTable from './InvoicesTable';

export const dynamic = 'force-dynamic';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date) {
  const mes = MESES[d.getUTCMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getUTCFullYear()}`;
}

export default async function InvoicesPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  const [invoices, buildings] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: searchParams.status as any },
      include: { vendor: true, category: true, allocations: { include: { building: true } } },
      orderBy: { receivedDate: 'desc' },
      take: 2000,
    }),
    prisma.building.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const rows = invoices.map((inv) => {
    const d = new Date(inv.receivedDate);
    return {
      id: inv.id,
      vendorName: inv.vendor.name,
      categoryName: inv.category?.name || null,
      period: periodLabel(inv.billingStart, inv.billingEnd),
      buildingLabel:
        inv.allocations.length > 1
          ? `${inv.allocations.length} edificios`
          : inv.allocations[0]?.building.name || '—',
      buildingNames: inv.allocations.map((a) => a.building.name),
      total: Number(inv.total),
      receivedDate: inv.receivedDate.toISOString(),
      status: inv.status,
      payable: inv.payable,
      monthKey: monthKey(d),
      monthLabel: monthLabel(d),
    };
  });

  const groupMap = new Map<string, { key: string; label: string; count: number; total: number }>();
  for (const r of rows) {
    if (!groupMap.has(r.monthKey)) {
      groupMap.set(r.monthKey, { key: r.monthKey, label: r.monthLabel, count: 0, total: 0 });
    }
    const g = groupMap.get(r.monthKey)!;
    g.count += 1;
    g.total += r.total;
  }
  const monthGroups = Array.from(groupMap.values()).sort((a, b) => b.key.localeCompare(a.key));

  const buildingOptions = buildings.map((b) => b.name);

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

      <div className="flex gap-2 text-sm flex-wrap">
        <Link href="/invoices" className={`px-3 py-1.5 rounded-md ${!searchParams.status ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>Todas</Link>
        <Link href="/invoices?status=PENDING" className={`px-3 py-1.5 rounded-md ${searchParams.status === 'PENDING' ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>Por aprobar</Link>
        <Link href="/invoices?status=APPROVED" className={`px-3 py-1.5 rounded-md ${searchParams.status === 'APPROVED' ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>Aprobadas</Link>
        <Link href="/invoices?status=PAID" className={`px-3 py-1.5 rounded-md ${searchParams.status === 'PAID' ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>Pagadas</Link>
        <Link href="/invoices?status=REJECTED" className={`px-3 py-1.5 rounded-md ${searchParams.status === 'REJECTED' ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>Rechazadas</Link>
      </div>

      <InvoicesTable rows={rows} monthGroups={monthGroups} isAdmin={isAdmin} buildingOptions={buildingOptions} />
    </div>
  );
}
