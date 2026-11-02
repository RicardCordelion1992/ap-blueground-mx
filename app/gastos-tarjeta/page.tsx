import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';
import UploadReceipt from './UploadReceipt';
import ReceiptsTable from './ReceiptsTable';
import ImportStatementForm from './ImportStatementForm';
import CardStatements from './CardStatements';

export const dynamic = 'force-dynamic';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function batchLabel(fileName: string | null, createdAt: Date) {
  const lower = (fileName || '').toLowerCase();
  const provider = lower.includes('jeeves') ? 'Jeeves' : lower.includes('brex') ? 'Brex' : 'Estado de cuenta';
  const mes = MESES[createdAt.getUTCMonth()];
  const anio = createdAt.getUTCFullYear();
  return `${provider} — ${mes} ${anio}`;
}

export default async function GastosTarjetaPage() {
  const user = await getCurrentUser();
  const canSeeAll = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [buildings, categories, receipts, cardChargesAll] = await Promise.all([
    prisma.building.findMany({ orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.cardExpenseReceipt.findMany({
      where: canSeeAll ? undefined : { uploadedById: user?.id },
      include: { uploadedBy: { select: { name: true } }, building: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    prisma.cardCharge.findMany({
      where: canSeeAll ? undefined : { assignedUserId: user?.id },
      include: {
        assignedUser: { select: { name: true } },
        building: { select: { name: true } },
        category: { select: { name: true } },
        batch: { select: { id: true, fileName: true, createdAt: true } },
      },
      orderBy: { chargeDate: 'desc' },
      take: 3000,
    }),
  ]);

  const rows = await Promise.all(
    receipts.map(async (r) => ({
      id: r.id,
      uploadedByName: r.uploadedBy?.name || '—',
      provider: r.provider,
      amount: r.amount !== null ? Number(r.amount) : null,
      expenseDate: r.expenseDate ? r.expenseDate.toISOString() : null,
      description: r.description,
      buildingId: r.buildingId,
      buildingName: r.building.name,
      categoryId: r.categoryId,
      categoryName: r.category?.name || null,
      previewUrl: await signDocUrl(INVOICES_BUCKET, r.fileUrl),
      createdAt: r.createdAt.toISOString(),
    }))
  );

  const batchMap = new Map<
    string,
    { id: string; fileName: string | null; createdAt: Date; charges: typeof cardChargesAll }
  >();
  for (const c of cardChargesAll) {
    if (!c.batch) continue;
    if (!batchMap.has(c.batch.id)) {
      batchMap.set(c.batch.id, {
        id: c.batch.id,
        fileName: c.batch.fileName,
        createdAt: c.batch.createdAt,
        charges: [],
      });
    }
    batchMap.get(c.batch.id)!.charges.push(c);
  }

  const batches = Array.from(batchMap.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((b) => ({
      id: b.id,
      label: batchLabel(b.fileName, b.createdAt),
      createdAt: b.createdAt.toISOString(),
      total: b.charges.length,
      totalAmount: b.charges.reduce((sum, c) => sum + Number(c.amount), 0),
      pending: b.charges.filter((c) => c.status === 'UNMATCHED').length,
      classified: b.charges.filter((c) => c.status === 'CLASSIFIED' || c.status === 'MATCHED').length,
      ignored: b.charges.filter((c) => c.status === 'IGNORED').length,
    }));

  const cardChargeRows = cardChargesAll.map((c) => ({
    id: c.id,
    batchId: c.batchId,
    chargeDate: c.chargeDate.toISOString(),
    descriptor: c.descriptor,
    amount: Number(c.amount),
    cardHolder: c.cardHolder,
    cardLast4: c.cardLast4,
    assignedUserName: c.assignedUser?.name || null,
    status: c.status,
    buildingName: c.building?.name || null,
    categoryName: c.category?.name || null,
  }));

  const buildingOptions = buildings.map((b) => ({ id: b.id, name: b.name }));
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Gastos de tarjeta</h1>
        <p className="text-sm text-gray-500">...</p>
      </div>
      {canSeeAll && <ImportStatementForm />}
      <CardStatements
        batches={batches}
        charges={cardChargeRows}
        buildings={buildingOptions}
        categories={categoryOptions}
        showCardHolder={canSeeAll}
      />
      <UploadReceipt buildings={buildingOptions} categories={categoryOptions} />
      <ReceiptsTable receipts={rows} buildings={buildingOptions} categories={categoryOptions} showUploadedBy={canSeeAll} />
    </div>
  );
}
