import { prisma } from '@/lib/prisma';
import BulkInvoiceForm from './BulkInvoiceForm';

export const dynamic = 'force-dynamic';

export default async function BulkInvoicePage() {
  const [vendors, buildings, categories] = await Promise.all([
    prisma.vendor.findMany({ select: { id: true, name: true, readiness: true }, orderBy: { name: 'asc' } }),
    prisma.building.findMany({ include: { units: true }, orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold mb-1">Carga masiva de facturas</h1>
      <p className="text-sm text-gray-600 mb-4">
        Para lotes de muchas facturas del mismo proveedor y edificio (como recibos de CFE o Gas mes a mes) — elige
        proveedor y edificio una sola vez y sube todos los archivos juntos.
      </p>
      <BulkInvoiceForm vendors={vendors} buildings={buildings} categories={categories} />
    </div>
  );
}
