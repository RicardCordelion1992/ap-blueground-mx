import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { extractFromText, extractFromImage } from '@/lib/invoiceExtraction';
import { createAdminClient } from '@/lib/supabase/server';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';

export const maxDuration = 60;

// Accepts a multipart form with `file` (PDF or image). Uploads it to
// Supabase Storage (invoice-files bucket) and returns both the extracted
// fields and the stored file URL so the client can prefill + submit the
// invoice form in one step.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file es requerido' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const bucket = INVOICES_BUCKET;
  const supabase = createAdminClient();
  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
  });
  if (uploadError) {
    return NextResponse.json({ error: `Error al subir archivo: ${uploadError.message}` }, { status: 500 });
  }
  // `path` (not a URL) is what gets stored on the Invoice — a signed link is
  // minted for the client here just so it can offer an immediate preview.
  const previewUrl = await signDocUrl(bucket, path);

  let fields;
  try {
    if (file.type === 'application/pdf') {
      // Text-first: most CFDI PDFs carry a real text layer.
      const pdfParse = (await import('pdf-parse')).default;
      const parsed = await pdfParse(buffer);
      if (parsed.text && parsed.text.trim().length > 40) {
        fields = await extractFromText(parsed.text);
      } else {
        return NextResponse.json({
          error: 'No se encontró texto en el PDF (parece escaneado). Sube una foto/imagen en su lugar, o captura los datos manualmente.',
          fileUrl: path,
          previewUrl,
          fileName: file.name,
        }, { status: 422 });
      }
    } else if (file.type.startsWith('image/')) {
      const base64 = buffer.toString('base64');
      fields = await extractFromImage(base64);
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Usa PDF o imagen (PNG/JPG).' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({
      error: `No se pudo extraer automáticamente (${e.message}). El archivo se guardó y puedes capturar los datos manualmente.`,
      fileUrl: path,
      previewUrl,
      fileName: file.name,
    }, { status: 422 });
  }

  // fileUrl = storage path (persisted on the Invoice); previewUrl = short-lived signed link for the form.
  return NextResponse.json({ fields, fileUrl: path, previewUrl, fileName: file.name });
}
