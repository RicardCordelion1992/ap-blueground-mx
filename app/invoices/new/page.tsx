import { prisma } from '@/lib/prisma';
import NewInvoiceForm from './NewInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const [vendors, buildings, categories] = await Promise.all([
    prisma.vendor.findMany({ select: { id: true, name: true, readiness: true }, orderBy: { name: 'asc' } }),
    prisma.building.findMany({ include: { units: true }, orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Nueva factura</h1>
      <NewInvoiceForm vendors={vendors} buildings={buildings} categories={categories} />
    </div>
  );
}
