import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

// Corrige un comprobante de gasto de tarjeta ya subido: el propio tarjetahabiente puede
// corregir su edificio/categoría/monto/fecha/descripción (por si la IA se equivocó, o cambió de
// opinión), y un ADMIN/FINANCE puede corregir cualquiera — necesario para cerrar el mes con
// información correcta.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const receipt = await prisma.cardExpenseReceipt.findUnique({ where: { id: params.id } });
  if (!receipt) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const isOwner = receipt.uploadedById === user.id;
  const canEdit = isOwner || user.role === 'ADMIN' || user.role === 'FINANCE';
  if (!canEdit) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.buildingId === 'string' && body.buildingId) {
    const building = await prisma.building.findUnique({ where: { id: body.buildingId } });
    if (!building) return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 400 });
    data.buildingId = body.buildingId;
  }
  if (body.categoryId === null || typeof body.categoryId === 'string') {
    data.categoryId = body.categoryId || null;
  }
  if (body.amount !== undefined) {
    const n = Number(body.amount);
    data.amount = Number.isFinite(n) ? n : null;
  }
  if (typeof body.expenseDate === 'string') {
    data.expenseDate = body.expenseDate ? new Date(body.expenseDate) : null;
  }
  if (typeof body.description === 'string' || body.description === null) {
    data.description = body.description || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const updated = await prisma.cardExpenseReceipt.update({
    where: { id: params.id },
    data,
    include: { building: true, category: true },
  });
  await logAudit(user.id, 'update', 'CardExpenseReceipt', updated.id, isOwner ? 'propio' : `por ${user.name}`);

  return NextResponse.json(updated);
}
