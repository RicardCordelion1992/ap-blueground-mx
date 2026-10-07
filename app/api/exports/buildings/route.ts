import { prisma } from '@/lib/prisma';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// Descarga en CSV de edificios y sus unidades (depas/PO), con el landlord de cada edificio,
// para análisis en Excel. Una fila por unidad; si un edificio no tiene unidades capturadas
// todavía, aparece una sola fila con los datos del edificio.
export async function GET() {
  const buildings = await prisma.building.findMany({
    include: { landlord: { select: { name: true, rfc: true } }, units: { orderBy: { unitNumber: 'asc' } } },
    orderBy: { name: 'asc' },
  });

  type Row = {
    buildingName: string;
    city: string;
    pmsCode: string | null;
    landlordName: string | null;
    landlordRfc: string | null;
    unitNumber: string | null;
    poCode: string | null;
  };

  const rows: Row[] = [];
  for (const b of buildings) {
    if (b.units.length === 0) {
      rows.push({
        buildingName: b.name,
        city: b.city,
        pmsCode: b.pmsCode,
        landlordName: b.landlord?.name ?? null,
        landlordRfc: b.landlord?.rfc ?? null,
        unitNumber: null,
        poCode: null,
      });
    } else {
      for (const u of b.units) {
        rows.push({
          buildingName: b.name,
          city: b.city,
          pmsCode: b.pmsCode,
          landlordName: b.landlord?.name ?? null,
          landlordRfc: b.landlord?.rfc ?? null,
          unitNumber: u.unitNumber,
          poCode: u.poCode,
        });
      }
    }
  }

  const csv = toCsv(rows, [
    { header: 'Edificio', value: (r) => r.buildingName },
    { header: 'Ciudad', value: (r) => r.city },
    { header: 'Código PMS', value: (r) => r.pmsCode },
    { header: 'Landlord / Propietario', value: (r) => r.landlordName },
    { header: 'RFC landlord', value: (r) => r.landlordRfc },
    { header: 'Depa / Unidad', value: (r) => r.unitNumber },
    { header: 'PO', value: (r) => r.poCode },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `edificios_${today}.csv`);
}
