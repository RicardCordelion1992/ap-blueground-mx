import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { recomputeVendorReadiness, missingVendorFields } from '@/lib/readiness';
import { logAudit } from '@/lib/audit';
import { DOCS_BUCKET, signDocUrl } from '@/lib/signedUrl';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      documents: { include: { docType: true }, orderBy: { docType: { sortOrder: 'asc' } } },
      ownedBuildings: true,
      defaultCategory: true,
      invoices: { orderBy: { receivedDate: 'desc' }, take: 20 },
    },
  });
  if (!vendor) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const requiredDocTypes = await prisma.documentType.findMany({
    where: { required: true, OR: [{ appliesTo: null }, { appliesTo: vendor.personType }] },
    orderBy: { sortOrder: 'asc' },
  });

  const documents = await Promise.all(
    vendor.documents.map(async (d) => ({ ...d, fileUrl: await signDocUrl(DOCS_BUCKET, d.fileUrl) }))
  );

  return NextResponse.json({
    ...vendor,
    documents,
    missingFields: missingVendorFields(vendor),
    requiredDocTypes,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const { ownedBuildingIds, ...data } = body;

  delete data.id;
  delete data.documents;
  delete data.invoices;
  delete data.readiness; // computed, never set directly by the client

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      ...data,
      ownedBuildings: ownedBuildingIds ? { set: ownedBuildingIds.map((id: string) => ({ id })) } : undefined,
    },
  });

  const result = await recomputeVendorReadiness(vendor.id);
  await logAudit(user.id, 'update', 'Vendor', vendor.id, vendor.name);

  return NextResponse.json({ ...vendor, ...result });
}
