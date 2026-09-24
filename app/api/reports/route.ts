import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Building- and unit-level breakdown of invoice allocations for a date range.
// $ amounts are stored (InvoiceAllocation.amount); % is always computed live
// here, never persisted, so it can't go stale as new invoices come in.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const allocations = await prisma.invoiceAllocation.findMany({
    where: {
      invoice: {
        receivedDate: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
    },
    include: {
      building: true,
      unit: true,
      invoice: { include: { category: true, vendor: { select: { name: true } } } },
    },
  });

  const total = allocations.reduce((s, a) => s + Number(a.amount), 0);

  const byBuilding = new Map<string, { buildingId: string; buildingName: string; amount: number }>();
  const byUnit = new Map<string, { buildingName: string; unitNumber: string; poCode: string | null; amount: number }>();

  for (const a of allocations) {
    const amt = Number(a.amount);

    const b = byBuilding.get(a.buildingId) || { buildingId: a.buildingId, buildingName: a.building.name, amount: 0 };
    b.amount += amt;
    byBuilding.set(a.buildingId, b);

    if (a.unitId && a.unit) {
      const key = a.unitId;
      const u = byUnit.get(key) || { buildingName: a.building.name, unitNumber: a.unit.unitNumber, poCode: a.unit.poCode, amount: 0 };
      u.amount += amt;
      byUnit.set(key, u);
    }
  }

  const buildingRows = [...byBuilding.values()]
    .map((b) => ({ ...b, percent: total > 0 ? (b.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const unitRows = [...byUnit.values()]
    .map((u) => ({ ...u, percent: total > 0 ? (u.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return NextResponse.json({ total, byBuilding: buildingRows, byUnit: unitRows });
}
