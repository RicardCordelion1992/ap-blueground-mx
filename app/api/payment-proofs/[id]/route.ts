import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

// Asignación manual de un comprobante que quedó en NEEDS_REVIEW: body { invoiceIds: string[] }.
// Marca cada factura seleccionada como PAID y vincula el comprobante a todas ellas.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const invoiceIds: string[] = Array.isArray(body.invoiceIds) ? body.invoiceIds : [];
  if (invoiceIds.length === 0) return NextResponse.json({ error: 'invoiceIds es requerido' }, { status: 400 });

  const proof = await prisma.paymentProof.findUnique({ where: { id: params.id } });
  if (!proof) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const invoices = await prisma.invoice.findMany({ where: { id: { in: invoiceIds } } });
  const skipped: { id: string; reason: string }[] = [];
  const assigned: string[] = [];

  for (const invoiceId of invoiceIds) {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) {
      skipped.push({ id: invoiceId, reason: 'No encontrada' });
      continue;
    }
    if (inv.status !== 'APPROVED') {
      skipped.push({ id: invoiceId, reason: `Estado actual: ${inv.status}` });
      continue;
    }
    if (!inv.payable) {
      skipped.push({ id: invoiceId, reason: 'Proveedor no está "Ready"' });
      continue;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidDate: proof.extractedDate || new Date(),
        paidVia: `Comprobante${proof.extractedReference ? ` (${proof.extractedReference})` : ''} (asignado a mano)`,
      },
    });
    await prisma.paymentProofAllocation.create({
      data: { paymentProofId: proof.id, invoiceId, amount: updated.total, matchedBy: 'manual' },
    });
    await logAudit(user.id, 'mark_paid', 'Invoice', invoiceId, `Comprobante ${proof.id} (manual)`);
    assigned.push(invoiceId);
  }

  if (assigned.length > 0) {
    await prisma.paymentProof.update({ where: { id: proof.id }, data: { status: 'CONFIRMED' } });
    await logAudit(user.id, 'confirm_match', 'PaymentProof', proof.id, `${assigned.length} factura(s)`);
  }

  return NextResponse.json({ assigned, skipped });
}
