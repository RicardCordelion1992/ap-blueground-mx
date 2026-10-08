import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/server';
import { INVOICES_BUCKET } from '@/lib/signedUrl';
import { extractFromText, extractFromImage, extractFromPdf, type ExtractedInvoiceFields } from '@/lib/invoiceExtraction';

export const maxDuration = 60;

// Mailgun "Routes" (correo entrante) llama a este endpoint como
// multipart/form-data cada vez que llega un correo a la dirección
// configurada (p. ej. facturas@tu-dominio.com). No hay sesión de usuario
// aquí — lo que autentica la llamada es la firma HMAC que Mailgun agrega a
// cada request, verificada con MAILGUN_WEBHOOK_SIGNING_KEY (variable de
// entorno en Vercel, se obtiene del dashboard de Mailgun: Sending > Domain
// settings > Webhook signing key).
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

  const timestamp = String(form.get('timestamp') || '');
  const token = String(form.get('token') || '');
  const signature = String(form.get('signature') || '');
  if (!verifyMailgunSignature(timestamp, token, signature)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  const sender = String(form.get('sender') || form.get('from') || 'desconocido');
  const subject = form.get('subject') ? String(form.get('subject')) : null;
  const attachmentCount = parseInt(String(form.get('attachment-count') || '0'), 10) || 0;

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
    if (uploadError) continue; // si falla la subida, nos saltamos este adjunto (no se pierde el correo entero)

    // Misma lógica de extracción que /api/invoices/extract (texto primero,
    // con respaldo de visión/PDF nativo) — si falla, el archivo igual queda
    // guardado y se captura a mano desde la Bandeja.
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

  // Mailgun solo necesita un 200 para no reintentar la entrega — no importa
  // si saved es 0 (correo sin adjuntos válidos).
  return NextResponse.json({ ok: true, saved });
}
