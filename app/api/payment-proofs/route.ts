import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/server';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';
import { extractProofFromText, extractProofFromImage, extractProofFromPdf, type ExtractedProofFields } from '@/lib/paymentProofExtraction';
import { matchPaymentProof } from '@/lib/paymentMatching';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const proofs = await prisma.paymentProof.findMany({
    include: {
      uploadedBy: { select: { name: true } },
      allocations: { include: { invoice: { include: { vendor: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const withPreview = await Promise.all(
    proofs.map(async (p) => ({ ...p, previewUrl: await signDocUrl(INVOICES_BUCKET, p.fileUrl) }))
  );

  return NextResponse.json(withPreview);
}

// Sube uno o varios comprobantes de pago a la vez (form field "files", repetido).
// Por cada archivo: lo guarda, le pide a la IA que extraiga monto/fecha/beneficiario, y trata de
// relacionarlo automáticamente con 1+ facturas APROBADAS. Si el match es claro, marca esas
// facturas como PAID de una vez. Si hay duda, el comprobante queda en NEEDS_REVIEW para
// asignarlo a mano desde /invoices/comprobantes.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'files es requerido' }, { status: 400 });

  const supabase = createAdminClient();
  const results: any[] = [];

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `comprobantes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(INVOICES_BUCKET).upload(path, buffer, {
        contentType: file.type,
      });
      if (uploadError) {
        results.push({ fileName: file.name, error: `Error al subir: ${uploadError.message}` });
        continue;
      }

      let fields: ExtractedProofFields = {};
      try {
        if (file.type === 'application/pdf') {
          let text = '';
          try {
            const pdfParse = (await import('pdf-parse')).default;
            const parsed = await pdfParse(buffer);
            text = parsed.text || '';
          } catch {
            text = '';
          }
          fields = text.trim().length > 20 ? await extractProofFromText(text) : await extractProofFromPdf(buffer.toString('base64'));
        } else if (file.type.startsWith('image/')) {
          fields = await extractProofFromImage(buffer.toString('base64'));
        }
      } catch {
        fields = {};
      }

      const match = await matchPaymentProof({ amount: fields.amount, beneficiaryName: fields.beneficiaryName });

      const proof = await prisma.paymentProof.create({
        data: {
          fileUrl: path,
          fileName: file.name,
          uploadedById: user.id,
          extractedAmount: fields.amount ?? null,
          extractedDate: fields.date ? new Date(fields.date) : null,
          extractedReference: fields.reference || null,
          extractedBeneficiary: fields.beneficiaryName || null,
          extractedFields: JSON.stringify(fields),
          status: match.kind === 'single' ? 'AUTO_MATCHED' : 'NEEDS_REVIEW',
        },
      });

      if (match.kind === 'single') {
        for (const invoiceId of match.invoiceIds) {
          const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: 'PAID',
              paidDate: fields.date ? new Date(fields.date) : new Date(),
              paidVia: `Comprobante${fields.reference ? ` (${fields.reference})` : ''}`,
            },
          });
          await prisma.paymentProofAllocation.create({
            data: { paymentProofId: proof.id, invoiceId, amount: updated.total, matchedBy: 'auto' },
          });
          await logAudit(user.id, 'mark_paid', 'Invoice', invoiceId, `Comprobante ${proof.id} (auto)`);
        }
        await logAudit(user.id, 'auto_match', 'PaymentProof', proof.id, `${match.invoiceIds.length} factura(s)`);
      } else {
        await logAudit(user.id, 'needs_review', 'PaymentProof', proof.id);
      }

      results.push({ fileName: file.name, proofId: proof.id, status: proof.status, matchedInvoices: match.kind === 'single' ? match.invoiceIds.length : 0 });
    } catch (e: any) {
      results.push({ fileName: file.name, error: e.message || 'Error inesperado' });
    }
  }

  return NextResponse.json({ results });
}
