import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

// Aprueba varias facturas de un solo jalón — mismo criterio que la aprobación individual
// (solo un ADMIN, y solo facturas que están "Por aprobar"). body: { invoiceIds: string[] }.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo un administrador puede aprobar facturas.' }, { status: 403 });
  }

  const body = await req.json();
  const invoiceIds: string[] = Array.isArray(body.invoiceIds) ? body.invoiceIds : [];
  if (invoiceIds.length === 0) return NextResponse.json({ error: 'invoiceIds es requerido' }, { status: 400 });

  const invoices = await prisma.invoice.findMany({ where: { id: { in: invoiceIds } } });
  const updated: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of invoiceIds) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) {
      skipped.push({ id, reason: 'No encontrada' });
      continue;
    }
    if (inv.status !== 'PENDING') {
      skipped.push({ id, reason: `Estado actual: ${inv.status}` });
      continue;
    }
    await prisma.invoice.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date(), rejectedReason: null },
    });
    await logAudit(user.id, 'approve', 'Invoice', id, 'Aprobación masiva');
    updated.push(id);
  }

  return NextResponse.json({ updated, skipped });
}
