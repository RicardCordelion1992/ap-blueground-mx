import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const charge = await prisma.cardCharge.findUnique({ where: { id: params.id } });
  if (!charge) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const isAdminOrFinance = me.role === 'ADMIN' || me.role === 'FINANCE';
  const isOwner = charge.assignedUserId === me.id;
  if (!isAdminOrFinance && !isOwner) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();

  if (body.ignore === true) {
    const updated = await prisma.cardCharge.update({
      where: { id: params.id },
      data: { status: 'IGNORED' },
    });
    return NextResponse.json(updated);
  }

  const { buildingId, categoryId } = body;
  if (!buildingId || !categoryId) {
    return NextResponse.json(
      { error: 'Se requiere edificio y categoría' },
      { status: 400 }
    );
  }

  const updated = await prisma.cardCharge.update({
    where: { id: params.id },
    data: {
      buildingId,
      categoryId,
      status: 'CLASSIFIED',
    },
  });

  return NextResponse.json(updated);
}
