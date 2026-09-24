import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { vendor: true, category: true, allocations: { include: { building: true, unit: true } }, createdBy: true },
  });
  if (!invoice) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();

  // Marking as paid
  if (body.status === 'PAID') {
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: { status: 'PAID', paidDate: body.paidDate ? new Date(body.paidDate) : new Date(), paidVia: body.paidVia || null },
    });
    await logAudit(user.id, 'mark_paid', 'Invoice', invoice.id);
    return NextResponse.json(invoice);
  }

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      invoiceNumber: body.invoiceNumber,
      categoryId: body.categoryId || null,
      notes: body.notes,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
  });
  await logAudit(user.id, 'update', 'Invoice', invoice.id);
  return NextResponse.json(invoice);
}
