import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

// Marca varias facturas como pagadas de un solo jalón — pensado para el caso de, por ejemplo,
// varias facturas de CFE (una por edificio) que se pagaron juntas con la tarjeta corporativa y
// van a aparecer en el estado de cuenta. body: { invoiceIds: string[], paidDate?: string, paidVia?: string }.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const invoiceIds: string[] = Array.isArray(body.invoiceIds) ? body.invoiceIds : [];
  if (invoiceIds.length === 0) return NextResponse.json({ error: 'invoiceIds es requerido' }, { status: 400 });

  const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
  const paidVia: string | null = body.paidVia || null;

  const invoices = await prisma.invoice.findMany({ where: { id: { in: invoiceIds } } });
  const updated: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of invoiceIds) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) {
      skipped.push({ id, reason: 'No encontrada' });
      continue;
    }
    if (inv.status !== 'APPROVED') {
      skipped.push({ id, reason: `Estado actual: ${inv.status}` });
      continue;
    }
    if (!inv.payable) {
      skipped.push({ id, reason: 'Proveedor no está "Ready"' });
      continue;
    }
    await prisma.invoice.update({ where: { id }, data: { status: 'PAID', paidDate, paidVia } });
    await logAudit(user.id, 'mark_paid', 'Invoice', id, `Pago masivo${paidVia ? ` · ${paidVia}` : ''}`);
    updated.push(id);
  }

  return NextResponse.json({ updated, skipped });
}
