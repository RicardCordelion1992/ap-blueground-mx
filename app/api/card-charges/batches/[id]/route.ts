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
