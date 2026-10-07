import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// Descarga en CSV de las facturas, desglosadas una fila por asignación a edificio/unidad
// (igual que la pantalla de Reportes) para que el total de una factura repartida entre
// varios edificios se pueda analizar por edificio en Excel. Admite los mismos filtros que
// la pantalla de Reportes (from/to por fecha recibida) y los que ya usa /api/invoices.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const status = req.nextUrl.searchParams.get('status');
  const vendorId = req.nextUrl.searchParams.get('vendorId');
  const buildingId = req.nextUrl.searchParams.get('buildingId');

  const invoices = await prisma.invoice.findMany({
    where: {
      receivedDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
      status: status ? (status as any) : undefined,
      vendorId: vendorId || undefined,
      allocations: buildingId ? { some: { buildingId } } : undefined,
    },
    include: {
      vendor: { select: { name: true, rfc: true } },
      category: true,
      createdBy: { select: { name: true } },
      allocations: { include: { building: true, unit: true } },
    },
    orderBy: { receivedDate: 'desc' },
  });

  type Row = {
    invoiceNumber: string | null;
    vendorName: string;
    vendorRfc: string | null;
    receivedDate: Date;
    issueDate: Date | null;
    dueDate: Date | null;
    currency: string;
    subtotal: number | null;
    taxAmount: number | null;
    total: number;
    category: string | null;
    buildingName: string;
    unitNumber: string | null;
    poCode: string | null;
    allocatedAmount: number;
    status: string;
    payable: boolean;
    paidDate: Date | null;
    paidVia: string | null;
    billingStart: Date | null;
    billingEnd: Date | null;
    sourceSystem: string;
    createdBy: string | null;
    notes: string | null;
  };

  const rows: Row[] = [];
  for (const inv of invoices) {
    for (const a of inv.allocations) {
      rows.push({
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor.name,
        vendorRfc: inv.vendor.rfc,
        receivedDate: inv.receivedDate,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        currency: inv.currency,
        subtotal: inv.subtotal != null ? Number(inv.subtotal) : null,
        taxAmount: inv.taxAmount != null ? Number(inv.taxAmount) : null,
        total: Number(inv.total),
        category: inv.category?.name ?? null,
        buildingName: a.building.name,
        unitNumber: a.unit?.unitNumber ?? null,
        poCode: a.unit?.poCode ?? null,
        allocatedAmount: Number(a.amount),
        status: inv.status,
        payable: inv.payable,
        paidDate: inv.paidDate,
        paidVia: inv.paidVia,
        billingStart: inv.billingStart,
        billingEnd: inv.billingEnd,
        sourceSystem: inv.sourceSystem,
        createdBy: inv.createdBy?.name ?? null,
        notes: inv.notes,
      });
    }
  }

  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

  const csv = toCsv(rows, [
    { header: 'No. factura', value: (r) => r.invoiceNumber },
    { header: 'Proveedor', value: (r) => r.vendorName },
    { header: 'RFC proveedor', value: (r) => r.vendorRfc },
    { header: 'Fecha recibida', value: (r) => fmtDate(r.receivedDate) },
    { header: 'Fecha de emisión', value: (r) => fmtDate(r.issueDate) },
    { header: 'Fecha de vencimiento', value: (r) => fmtDate(r.dueDate) },
    { header: 'Moneda', value: (r) => r.currency },
    { header: 'Subtotal factura', value: (r) => r.subtotal },
    { header: 'IVA factura', value: (r) => r.taxAmount },
    { header: 'Total factura', value: (r) => r.total },
    { header: 'Categoría', value: (r) => r.category },
    { header: 'Edificio', value: (r) => r.buildingName },
    { header: 'Depa / Unidad', value: (r) => r.unitNumber },
    { header: 'PO', value: (r) => r.poCode },
    { header: 'Monto asignado a este edificio/unidad', value: (r) => r.allocatedAmount },
    { header: 'Estatus', value: (r) => (r.status === 'PAID' ? 'Pagada' : 'Pendiente') },
    { header: 'Pagable (proveedor Ready)', value: (r) => (r.payable ? 'Sí' : 'No') },
    { header: 'Fecha de pago', value: (r) => fmtDate(r.paidDate) },
    { header: 'Pagado vía', value: (r) => r.paidVia },
    { header: 'Periodo facturado desde', value: (r) => fmtDate(r.billingStart) },
    { header: 'Periodo facturado hasta', value: (r) => fmtDate(r.billingEnd) },
    { header: 'Origen', value: (r) => (r.sourceSystem === 'manual' ? 'Captura manual' : r.sourceSystem) },
    { header: 'Capturado por', value: (r) => r.createdBy },
    { header: 'Notas', value: (r) => r.notes },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `facturas_${today}.csv`);
}
