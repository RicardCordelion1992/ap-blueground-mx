import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const building = await prisma.building.findUnique({
    where: { id: params.id },
    include: { landlord: true, units: { orderBy: { unitNumber: 'asc' } } },
  });
  if (!building) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(building);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const building = await prisma.building.update({
    where: { id: params.id },
    data: { name: body.name, city: body.city, pmsCode: body.pmsCode, landlordId: body.landlordId || null },
  });

  await logAudit(user.id, 'update', 'Building', building.id, building.name);
  return NextResponse.json(building);
}
