import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/server';
import { INVOICES_BUCKET } from '@/lib/signedUrl';
import { extractFromText, extractFromImage, extractFromPdf, type ExtractedInvoiceFields } from '@/lib/invoiceExtraction';

export const maxDuration = 60;

function verifyMailgunSignature(timestamp: string, token: string, signature: string): boolean {
  const key = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!key || !timestamp || !token || !signature) return false;
  const expected = crypto.createHmac('sha256', key).update(timestamp + token).digest('hex');
  return expected === signature;
}

function looksLikeInvoiceFile(file: File): boolean {
  if (file.type === 'application/pdf') return true;
  if (file.type.startsWith('image/')) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();

  // DEBUG TEMPORAL: para ver exactamente qué campos manda Mailgun.
  console.log('[mailgun-inbound] form keys:', Array.from(form.keys()));
  console.log('[mailgun-inbound] attachment-count raw:', form.get('attachment-count'));
  console.log('[mailgun-inbound] signature fields present:', {
    hasTimestamp: form.has('timestamp'),
    hasToken: form.has('token'),
    hasSignature: form.has('signature'),
  });

  const timestamp = String(form.get('timestamp') || '');
  const token = String(form.get('token') || '');
  const signature = String(form.get('signature') || '');
  if (!verifyMailgunSignature(timestamp, token, signature)) {
    console.log('[mailgun-inbound] firma inválida o ausente');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  const sender = String(form.get('sender') || form.get('from') || 'desconocido');
  const subject = form.get('subject') ? String(form.get('subject')) : null;
  const attachmentCount = parseInt(String(form.get('attachment-count') || '0'), 10) || 0;

  console.log('[mailgun-inbound] sender:', sender, 'subject:', subject, 'attachmentCount:', attachmentCount);

  const bucket = INVOICES_BUCKET;
  const supabase = createAdminClient();
  let saved = 0;

  for (let i = 1; i <= attachmentCount; i++) {
    const file = form.get(`attachment-${i}`) as File | null;
    if (!file || !looksLikeInvoiceFile(file)) continue;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = (file.name || 'factura').split('.').pop() || 'pdf';
    const path = `inbound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: file.type,
    });
    if (uploadError) continue;

    let fields: ExtractedInvoiceFields | null = null;
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
        fields = text.trim().length > 40 ? await extractFromText(text) : await extractFromPdf(buffer.toString('base64'));
      } else {
        fields = await extractFromImage(buffer.toString('base64'));
      }
    } catch {
      fields = null;
    }

    await prisma.inboundInvoiceEmail.create({
      data: {
        fromEmail: sender,
        subject,
        fileUrl: path,
        fileName: file.name || null,
        extractedFields: fields ? JSON.stringify(fields) : null,
      },
    });
    saved++;
  }

  console.log('[mailgun-inbound] saved:', saved);
  return NextResponse.json({ ok: true, saved });
}
