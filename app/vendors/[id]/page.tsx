import { prisma } from '@/lib/prisma';
import { missingVendorFields } from '@/lib/readiness';
import { notFound } from 'next/navigation';
import VendorDetailClient from './VendorDetailClient';
import { DOCS_BUCKET, signDocUrl } from '@/lib/signedUrl';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: { documents: true, ownedBuildings: true },
  });
  if (!vendor) notFound();

  const requiredDocTypes = await prisma.documentType.findMany({
    where: { required: true, OR: [{ appliesTo: null }, { appliesTo: vendor.personType }] },
    orderBy: { sortOrder: 'asc' },
  });

  const buildings = await prisma.building.findMany({ orderBy: { name: 'asc' } });

  const documentsWithSignedUrls = await Promise.all(
    vendor.documents.map(async (d) => ({
      ...d,
      expiresDate: d.expiresDate?.toISOString() ?? null,
      fileUrl: await signDocUrl(DOCS_BUCKET, d.fileUrl),
    }))
  );

  const enriched = {
    ...vendor,
    missingFields: missingVendorFields(vendor),
    requiredDocTypes,
    documents: documentsWithSignedUrls,
  };

  return <VendorDetailClient vendor={enriched as any} buildings={buildings} />;
}
