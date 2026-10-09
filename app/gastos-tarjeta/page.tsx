import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';
import UploadReceipt from './UploadReceipt';
import ReceiptsTable from './ReceiptsTable';

export const dynamic = 'force-dynamic';

// Para que cada tarjetahabiente (Brex: Ricardo, Sofía, Rodrigo, Pablo Angeles; Jeeves: solo
// Ricardo, para utilities) suba su propio comprobante de gasto y lo clasifique por edificio —
// sin tener que pasar por el resto de la plataforma. ADMIN/FINANCE ven y pueden corregir los de
// todos, para armar el cierre de mes (transferencias + facturas + tarjeta).
export default async function GastosTarjetaPage() {
  const user = await getCurrentUser();
  const canSeeAll = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [buildings, categories, receipts] = await Promise.all([
    prisma.building.findMany({ orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.cardExpenseReceipt.findMany({
      where: canSeeAll ? undefined : { uploadedById: user?.id },
      include: { uploadedBy: { select: { name: true } }, building: true, category: true },
      orderBy: { createdAt: 'desc' },
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

  const buildingOptions = buildings.map((b) => ({ id: b.id, name: b.name }));
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Gastos de tarjeta</h1>
        <p className="text-sm text-gray-500">
          Sube el comprobante/factura de cada gasto que hiciste con tu tarjeta (Brex o Jeeves) y clasifícalo
          por edificio. {canSeeAll ? 'Aquí ves los de todas las personas, para armar el cierre de mes.' : ''}
        </p>
      </div>

      <UploadReceipt buildings={buildingOptions} categories={categoryOptions} />

      <ReceiptsTable receipts={rows} buildings={buildingOptions} categories={categoryOptions} showUploadedBy={canSeeAll} />
    </div>
  );
}
