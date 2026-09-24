import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/currentUser';
import { recomputeVendorReadiness } from '@/lib/readiness';
import { logAudit } from '@/lib/audit';
import { DOCS_BUCKET, signDocUrl } from '@/lib/signedUrl';

// Multipart upload: file + docTypeId (+ optional issuedDate/expiresDate).
// Stores the file in Supabase Storage and upserts the VendorDocument row,
// then recomputes the vendor's Ready/Not-payable status.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const docTypeId = form.get('docTypeId') as string | null;
  const issuedDate = form.get('issuedDate') as string | null;
  const expiresDate = form.get('expiresDate') as string | null;

  if (!file || !docTypeId) {
    return NextResponse.json({ error: 'file y docTypeId son requeridos' }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: params.id } });
  const bucket = DOCS_BUCKET;
  const supabase = createAdminClient();

  const ext = file.name.split('.').pop() || 'pdf';
  const path = `${vendor.id}/${docTypeId}-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Error al subir archivo: ${uploadError.message}` }, { status: 500 });
  }

  // We store only the object PATH (not a URL) — the bucket is private, so a
  // usable link is minted on demand via signDocUrl() whenever the document
  // is displayed, and expires shortly after.
  const doc = await prisma.vendorDocument.upsert({
    where: { vendorId_docTypeId: { vendorId: vendor.id, docTypeId } },
    create: {
      vendorId: vendor.id,
      docTypeId,
      status: 'RECEIVED',
      fileUrl: path,
      fileName: file.name,
      issuedDate: issuedDate ? new Date(issuedDate) : null,
      expiresDate: expiresDate ? new Date(expiresDate) : null,
      uploadedById: user.id,
      uploadedAt: new Date(),
    },
    update: {
      status: 'RECEIVED',
      fileUrl: path,
      fileName: file.name,
      issuedDate: issuedDate ? new Date(issuedDate) : null,
      expiresDate: expiresDate ? new Date(expiresDate) : null,
      uploadedById: user.id,
      uploadedAt: new Date(),
    },
  });

  const result = await recomputeVendorReadiness(vendor.id);
  await logAudit(user.id, 'upload_document', 'Vendor', vendor.id, doc.docTypeId);

  const signedUrl = await signDocUrl(bucket, doc.fileUrl);
  return NextResponse.json({ document: { ...doc, fileUrl: signedUrl }, readiness: result });
}
