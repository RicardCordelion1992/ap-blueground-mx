import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { DOCUMENT_TYPE_SEED } from '@/lib/documentTypes';
import { recomputeVendorReadiness } from '@/lib/readiness';
import { logAudit } from '@/lib/audit';

// ADMIN-only, one-click tool: re-applies the current DOCUMENT_TYPE_SEED list
// (lib/documentTypes.ts) onto the live DocumentType table — e.g. after
// marking a document type as no-longer-required in code — and then
// recomputes every vendor's readiness, since a document that stops being
// required can immediately flip a vendor from "Incompleto" to "Ready".
// Existing VendorDocument rows (already-uploaded files) are never touched.
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo un administrador puede sincronizar los tipos de documento.' }, { status: 403 });
  }

  for (const dt of DOCUMENT_TYPE_SEED) {
  await prisma.documentType.upsert({
      where: { name: dt.name },
      update: {
        appliesTo: dt.appliesTo as any,
        required: dt.required,
        expires: dt.expires,
        sortOrder: dt.sortOrder,
      },
      create: {
        name: dt.name,
        appliesTo: dt.appliesTo as any,
        required: dt.required,
        expires: dt.expires,
        sortOrder: dt.sortOrder,
      },
    });
  }

  const vendors = await prisma.vendor.findMany({ select: { id: true } });
  let promoted = 0;
  for (const v of vendors) {
    const before = await prisma.vendor.findUnique({ where: { id: v.id }, select: { readiness: true } });
    const result = await recomputeVendorReadiness(v.id);
    if (before?.readiness !== 'READY' && result.ready) promoted++;
  }

  await logAudit(user.id, 'update', 'DocumentType', 'sync', `Sincronizó ${DOCUMENT_TYPE_SEED.length} tipos de documento; ${promoted} proveedores pasaron a Ready.`);

  return NextResponse.json({ types: DOCUMENT_TYPE_SEED.length, vendorsChecked: vendors.length, promotedToReady: promoted });
}
