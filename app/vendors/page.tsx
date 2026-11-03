import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/currentUser';
import BulkReadyButton from './BulkReadyButton';

export const dynamic = 'force-dynamic';

export default async function VendorsPage({ searchParams }: { searchParams: { readiness?: string; q?: string } }) {
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  const vendors = await prisma.vendor.findMany({
    where: {
      ...(searchParams.readiness ? { readiness: searchParams.readiness as any } : {}),
      OR: searchParams.q
        ? [{ name: { contains: searchParams.q, mode: 'insensitive' } }, { rfc: { contains: searchParams.q, mode: 'insensitive' } }]
        : undefined,
    },
    include: { _count: { select: { documents: true, invoices: true, ownedBuildings: true } } },
    orderBy: {
