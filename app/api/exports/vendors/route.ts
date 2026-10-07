import { prisma } from '@/lib/prisma';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// Descarga en CSV de todos los proveedores/landlords con sus datos completos
// (fiscales, bancarios, de contacto y de estatus) para análisis en Excel.
export async function GET() {
  const vendors = await prisma.vendor.findMany({
    include: {
      defaultCategory: true,
      _count: { select: { documents: true, invoices: true, ownedBuildings: true } },
    },
    orderBy: { name: 'asc' },
  });

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const csv = toCsv(vendors, [
    { header: 'Nombre', value: (v) => v.name },
    { header: 'RFC', value: (v) => v.rfc },
    { header: 'Tipo de persona', value: (v) => (v.personType === 'MORAL' ? 'Persona moral' : 'Persona física') },
    { header: 'Estatus', value: (v) => (v.status === 'active' ? 'Activo' : 'Inactivo') },
    { header: 'Listo para pago', value: (v) => (v.readiness === 'READY' ? 'Ready' : 'Incompleto') },
    { header: 'Ready marcado manualmente', value: (v) => (v.readinessOverride ? 'Sí' : 'No') },
    { header: 'CURP', value: (v) => v.curp },
    { header: 'Representante legal', value: (v) => v.legalRepName },
    { header: 'RFC representante', value: (v) => v.legalRepRfc },
    { header: 'Domicilio fiscal', value: (v) => v.fiscalAddress },
    { header: 'Régimen fiscal', value: (v) => v.taxRegime },
    { header: 'Uso de CFDI', value: (v) => v.cfdiUse },
    { header: 'Correo', value: (v) => v.email },
    { header: 'Teléfono', value: (v) => v.phone },
    { header: 'Contacto', value: (v) => v.contactName },
    { header: 'Banco', value: (v) => v.bankName },
    { header: 'CLABE', value: (v) => v.clabe },
    { header: 'Cuenta', value: (v) => v.accountNumber },
    { header: 'SWIFT', value: (v) => v.swiftCode },
    { header: 'Moneda', value: (v) => v.currency },
    { header: 'Condiciones de pago', value: (v) => v.paymentTerms },
    { header: 'Día de pago', value: (v) => v.paymentDueDay },
    { header: 'Categoría de gasto por default', value: (v) => v.defaultCategory?.name },
    { header: 'Documentos subidos', value: (v) => v._count.documents },
    { header: 'Facturas registradas', value: (v) => v._count.invoices },
    { header: 'Edificios a su cargo', value: (v) => v._count.ownedBuildings },
    { header: 'Notas', value: (v) => v.notes },
    { header: 'Creado', value: (v) => fmtDate(v.createdAt) },
    { header: 'Actualizado', value: (v) => fmtDate(v.updatedAt) },
  ]);

  const today = fmtDate(new Date());
  return csvResponse(csv, `proveedores_${today}.csv`);
}
