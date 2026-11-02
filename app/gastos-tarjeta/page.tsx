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
      amount: r.amount !== null ? Number(r.amount) :
