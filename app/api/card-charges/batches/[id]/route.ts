import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'ADMIN' && me.role !== 'FINANCE')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const label = typeof body.label === 'string' ? body.label.trim() : null;
  if (!label) {
    return NextResponse.json({ error: 'label es requerido' }, { status: 400 });
  }

  const batch = await prisma.cardImportBatch.update({
    where: { id: params.id },
    data: { label },
  });

  return NextResponse.json(batch);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const batch = await prisma.cardImportBatch.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  await prisma.cardImportBatch.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
