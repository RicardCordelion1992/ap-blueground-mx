import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';
import UploadReceipt from './UploadReceipt';
import ReceiptsTable from './ReceiptsTable';
import ImportStatementForm from './ImportStatementForm';
import CardChargesTable from './CardChargesTable';

export const dynamic = 'force-dynamic';

export default async function GastosTarjetaPage() {
  const user = await getCurrentUser();
  const canSeeAll = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [buildings, categories, receipts, cardCharges] = await Promise.all([
    prisma.building.findMany({ orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.cardExpenseReceipt.findMany({
      where: canSeeAll ? undefined : { uploadedById: user?.id },
      include: { uploadedBy: { select: { name: true } }, building: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    prisma.cardCharge.findMany({
      where: {
        status: 'UNMATCHED',
        ...(canSeeAll ? {} : { assignedUserId: user?.id }),
      },
      include: { assignedUser: { select: { name: true } } },
      orderBy: { chargeDate: 'desc' },
      take: 300,
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

  const cardChargeRows = cardCharges.map((c) => ({
    id: c.id,
    chargeDate: c.chargeDate.toISOString(),
    descriptor: c.descriptor,
    amount: Number(c.amount),
    cardHolder: c.cardHolder,
    cardLast4: c.cardLast4,
    assignedUserName: c.assignedUser?.name || null,
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
      <div>
        <h2 className="text-base font-semibold mb-2">Cargos por clasificar</h2>
        <CardChargesTable
          charges={cardChargeRows}
          buildings={buildingOptions}
          categories={categoryOptions}
          showCardHolder={canSeeAll}
        />
      </div>
      <UploadReceipt buildings={buildingOptions} categories={categoryOptions} />
      <ReceiptsTable receipts={rows} buildings={buildingOptions} categories={categoryOptions} showUploadedBy={canSeeAll} />
    </div>
  );
}
