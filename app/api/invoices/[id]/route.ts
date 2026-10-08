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

  // Etapa de aprobación: solo un ADMIN puede aprobar o rechazar (mismo criterio que la
  // aprobación de proveedores). Solo aplica a facturas que están "Por aprobar".
  if (body.status === 'APPROVED' || body.status === 'REJECTED') {
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo un administrador puede aprobar o rechazar facturas.' }, { status: 403 });
    }

    const current = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (current.status !== 'PENDING') {
      return NextResponse.json({ error: 'Solo se pueden aprobar o rechazar facturas que están por aprobar.' }, { status: 400 });
    }

    if (body.status === 'APPROVED') {
      const invoice = await prisma.invoice.update({
        where: { id: params.id },
        data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date(), rejectedReason: null },
      });
      await logAudit(user.id, 'approve', 'Invoice', invoice.id);
      return NextResponse.json(invoice);
    }

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: { status: 'REJECTED', rejectedReason: body.rejectedReason || null },
    });
    await logAudit(user.id, 'reject', 'Invoice', invoice.id, body.rejectedReason || undefined);
    return NextResponse.json(invoice);
  }

  // Reenviar una factura rechazada a revisión (vuelve a "Por aprobar").
  if (body.status === 'PENDING') {
    const current = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (current.status !== 'REJECTED') {
      return NextResponse.json({ error: 'Solo se pueden reenviar facturas rechazadas.' }, { status: 400 });
    }
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: { status: 'PENDING', rejectedReason: null },
    });
    await logAudit(user.id, 'resubmit', 'Invoice', invoice.id);
    return NextResponse.json(invoice);
  }

  // Marking as paid — solo a partir de una factura ya aprobada.
  if (body.status === 'PAID') {
    const current = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (current.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Solo se pueden pagar facturas ya aprobadas.' }, { status: 400 });
    }
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
