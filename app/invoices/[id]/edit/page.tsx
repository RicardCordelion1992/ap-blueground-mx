import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/currentUser';
import EditInvoiceForm from './EditInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (user?.role !== 'ADMIN') {
    redirect(`/invoices/${params.id}`);
  }

  const [invoice, vendors, buildings, categories] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: { allocations: true },
    }),
    prisma.vendor.findMany({ select: { id: true, name: true, readiness: true }, orderBy: { name: 'asc' } }),
    prisma.building.findMany({ include: { units: true }, orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  if (!invoice) notFound();

  const initialInvoice = {
    id: invoice.id,
    vendorId: invoice.vendorId,
    invoiceNumber: invoice.invoiceNumber || '',
    categoryId: invoice.categoryId || '',
    receivedDate: invoice.receivedDate.toISOString().slice(0, 10),
    issueDate: invoice.issueDate ? invoice.issueDate.toISOString().slice(0, 10) : '',
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : '',
    period: invoice.billingStart ? invoice.billingStart.toISOString().slice(0, 7) : '',
    subtotal: invoice.subtotal != null ? String(invoice.subtotal) : '',
    taxAmount: invoice.taxAmount != null ? String(invoice.taxAmount) : '',
    total: String(invoice.total),
    notes: invoice.notes || '',
    allocations: invoice.allocations.map((a) => ({
      buildingId: a.buildingId,
      unitId: a.unitId || '',
      amount: String(a.amount),
    })),
  };

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold mb-4">Editar factura</h1>
      <EditInvoiceForm invoice={initialInvoice} vendors={vendors} buildings={buildings} categories={categories} />
    </div>
  );
}
