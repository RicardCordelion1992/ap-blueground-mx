import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  if (!body.unitNumber?.trim()) return NextResponse.json({ error: 'unitNumber es requerido' }, { status: 400 });

  const unit = await prisma.unit.create({
    data: { buildingId: params.id, unitNumber: body.unitNumber.trim(), poCode: body.poCode || null },
  });

  await logAudit(user.id, 'create', 'Unit', unit.id, `${params.id} / ${unit.unitNumber}`);
  return NextResponse.json(unit, { status: 201 });
}
