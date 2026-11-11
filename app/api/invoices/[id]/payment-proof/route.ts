import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/server';
import { INVOICES_BUCKET } from '@/lib/signedUrl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo un administrador puede marcar facturas como pagadas.' }, { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  if (invoice.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Solo se pueden pagar facturas ya aprobadas.' }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file es requerido' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `comprobantes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage.from(INVOICES_BUCKET).upload(path, buffer, {
    contentType: file.type,
  });
  if (uploadError) {
    return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 });
  }

  const proof = await prisma.paymentProof.create({
    data: {
      fileUrl: path,
      fileName: file.name,
      uploadedById: user.id,
      status: 'CONFIRMED',
    },
  });

  await prisma.paymentProofAllocation.create({
    data: { paymentProofId: proof.id, invoiceId: invoice.id, amount: invoice.total, matchedBy: 'manual' },
  });

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: 'PAID', paidDate: new Date(), paidVia: `Comprobante (${file.name})` },
  });

  await logAudit(user.id, 'mark_paid', 'Invoice', invoice.id, `Comprobante ${proof.id} (manual)`);

  const proofViewUrl = `/api/files/view?bucket=${encodeURIComponent(INVOICES_BUCKET)}&path=${encodeURIComponent(path)}`;

  return NextResponse.json({ invoice: updated, proofId: proof.id, proofViewUrl });
}
