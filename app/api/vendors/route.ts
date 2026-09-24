import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { recomputeVendorReadiness } from '@/lib/readiness';
import { logAudit } from '@/lib/audit';

const VendorInput = z.object({
  personType: z.enum(['FISICA', 'MORAL']),
  name: z.string().min(1),
  rfc: z.string().min(1),
  curp: z.string().optional().nullable(),
  legalRepName: z.string().optional().nullable(),
  legalRepRfc: z.string().optional().nullable(),
  fiscalAddress: z.string().optional().nullable(),
  taxRegime: z.string().optional().nullable(),
  cfdiUse: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  clabe: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  currency: z.string().default('MXN'),
  paymentTerms: z.string().optional().nullable(),
  defaultCategoryId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  ownedBuildingIds: z.array(z.string()).optional().default([]),
});

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('q')?.trim();
  const readiness = req.nextUrl.searchParams.get('readiness');

  const vendors = await prisma.vendor.findMany({
    where: {
      AND: [
        search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { rfc: { contains: search, mode: 'insensitive' } }] }
          : {},
        readiness ? { readiness: readiness as any } : {},
      ],
    },
    include: {
      _count: { select: { documents: true, invoices: true, ownedBuildings: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const parsed = VendorInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { ownedBuildingIds, ...data } = parsed.data;

  const existing = await prisma.vendor.findUnique({ where: { rfc: data.rfc } });
  if (existing) {
    return NextResponse.json({ error: `Ya existe un proveedor con RFC ${data.rfc}: ${existing.name}` }, { status: 409 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      ...data,
      email: data.email || null,
      ownedBuildings: ownedBuildingIds?.length ? { connect: ownedBuildingIds.map((id) => ({ id })) } : undefined,
    },
  });

  await recomputeVendorReadiness(vendor.id);
  await logAudit(user.id, 'create', 'Vendor', vendor.id, vendor.name);

  const fresh = await prisma.vendor.findUnique({ where: { id: vendor.id } });
  return NextResponse.json(fresh, { status: 201 });
}
