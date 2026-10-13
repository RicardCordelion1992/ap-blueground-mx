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

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo un administrador puede editar facturas.' }, { status: 403 });
  }

  const current = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  if (!body.vendorId) {
    return NextResponse.json({ error: 'Selecciona un proveedor.' }, { status: 400 });
  }

  const allocations = Array.isArray(body.allocations)
    ? body.allocations
        .filter((a: any) => a.buildingId && a.amount)
        .map((a: any) => ({ buildingId: a.buildingId, unitId: a.unitId || null, amount: parseFloat(a.amount) }))
    : null;

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      vendorId: body.vendorId,
      invoiceNumber: body.invoiceNumber || null,
      categoryId: body.categoryId || null,
      receivedDate: body.receivedDate ? new Date(body.receivedDate) : undefined,
      issueDate: body.issueDate ? new Date(body.issueDate) : null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      billingStart: body.billingStart ? new Date(body.billingStart) : null, // NUEVO
      billingEnd: body.billingEnd ? new Date(body.billingEnd) : null, // NUEVO
      subtotal: body.subtotal ? parseFloat(body.subtotal) : null,
      taxAmount: body.taxAmount ? parseFloat(body.taxAmount) : null,
      total: body.total != null ? parseFloat(body.total) : undefined,
      notes: body.notes || null,
      ...(allocations ? { allocations: { deleteMany: {}, create: allocations } } : {}),
    },
  });
  await logAudit(user.id, 'update', 'Invoice', invoice.id);
  return NextResponse.json(invoice);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo un administrador puede eliminar facturas.' }, { status: 403 });
  }

  const current = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  try {
    await prisma.invoice.update({
      where: { id: params.id },
      data: { allocations: { deleteMany: {} } },
    });
    await prisma.invoice.delete({ where: { id: params.id } });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'No se pudo eliminar la factura — puede que otro registro (como un correo vinculado) todavía la referencie.' },
      { status: 409 }
    );
  }

  await logAudit(user.id, 'delete', 'Invoice', params.id);
  return NextResponse.json({ ok: true });
}
