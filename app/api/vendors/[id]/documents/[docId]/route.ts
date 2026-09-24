import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { recomputeVendorReadiness } from '@/lib/readiness';
import { logAudit } from '@/lib/audit';

// Manual status override (e.g. mark a document VALID after review, or
// REJECTED if it doesn't meet requirements) without re-uploading a file.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const doc = await prisma.vendorDocument.update({
    where: { id: params.docId },
    data: {
      status: body.status,
      notes: body.notes,
      expiresDate: body.expiresDate ? new Date(body.expiresDate) : undefined,
    },
  });

  const result = await recomputeVendorReadiness(params.id);
  await logAudit(user.id, 'update_document_status', 'Vendor', params.id, `${doc.docTypeId} -> ${body.status}`);

  return NextResponse.json({ document: doc, readiness: result });
}
