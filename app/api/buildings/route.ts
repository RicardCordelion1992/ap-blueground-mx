import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const buildings = await prisma.building.findMany({
    include: { landlord: { select: { id: true, name: true, readiness: true } }, units: true, _count: { select: { units: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(buildings);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'name es requerido' }, { status: 400 });

  const building = await prisma.building.create({
    data: { name: body.name.trim(), city: body.city || 'CDMX', pmsCode: body.pmsCode || null, landlordId: body.landlordId || null },
  });

  await logAudit(user.id, 'create', 'Building', building.id, building.name);
  return NextResponse.json(building, { status: 201 });
}
