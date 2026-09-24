import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

const AllocationInput = z.object({
  buildingId: z.string(),
  unitId: z.string().optional().nullable(),
  amount: z.number().positive(),
});

const InvoiceInput = z.object({
  vendorId: z.string(),
  invoiceNumber: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  receivedDate: z.string(),
  dueDate: z.string().optional().nullable(),
  currency: z.string().default('MXN'),
  subtotal: z.number().optional().nullable(),
  taxRate: z.number().optional().nullable(),
  taxAmount: z.number().optional().nullable(),
  total: z.number().positive(),
  categoryId: z.string().optional().nullable(),
  billingStart: z.string().optional().nullable(),
  billingEnd: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allocations: z.array(AllocationInput).min(1, 'Se requiere al menos una asignación a un edificio'),
});

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status');
  const vendorId = req.nextUrl.searchParams.get('vendorId');
  const buildingId = req.nextUrl.searchParams.get('buildingId');

  const invoices = await prisma.invoice.findMany({
    where: {
      status: status ? (status as any) : undefined,
      vendorId: vendorId || undefined,
      allocations: buildingId ? { some: { buildingId } } : undefined,
    },
    include: {
      vendor: { select: { id: true, name: true, readiness: true } },
      category: true,
      allocations: { include: { building: true, unit: true } },
    },
    orderBy: { receivedDate: 'desc' },
  });

  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  const parsed = InvoiceInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const allocatedSum = data.allocations.reduce((s, a) => s + a.amount, 0);
  if (Math.abs(allocatedSum - data.total) > 0.5) {
    return NextResponse.json(
      { error: `La suma de asignaciones (${allocatedSum.toFixed(2)}) no coincide con el total (${data.total.toFixed(2)})` },
      { status: 400 }
    );
  }

  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: data.vendorId } });

  const invoice = await prisma.invoice.create({
    data: {
      vendorId: data.vendorId,
      invoiceNumber: data.invoiceNumber || null,
      issueDate: data.issueDate ? new Date(data.issueDate) : null,
      receivedDate: new Date(data.receivedDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      currency: data.currency,
      subtotal: data.subtotal ?? undefined,
      taxRate: data.taxRate ?? undefined,
      taxAmount: data.taxAmount ?? undefined,
      total: data.total,
      categoryId: data.categoryId || null,
      billingStart: data.billingStart ? new Date(data.billingStart) : null,
      billingEnd: data.billingEnd ? new Date(data.billingEnd) : null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      notes: data.notes || null,
      payable: vendor.readiness === 'READY',
      createdById: user.id,
      allocations: {
        create: data.allocations.map((a) => ({ buildingId: a.buildingId, unitId: a.unitId || null, amount: a.amount })),
      },
    },
    include: { allocations: { include: { building: true, unit: true } }, vendor: true },
  });

  await logAudit(user.id, 'create', 'Invoice', invoice.id, `${vendor.name} · ${invoice.total}`);
  return NextResponse.json(invoice, { status: 201 });
}
