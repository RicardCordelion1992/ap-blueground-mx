import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/server';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';
import {
  extractReceiptFromText,
  extractReceiptFromImage,
  extractReceiptFromPdf,
  type ExtractedReceiptFields,
} from '@/lib/cardReceiptExtraction';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROVIDERS = ['BREX', 'JEEVES'] as const;

// Un CARDHOLDER solo ve sus propios comprobantes (es lo único que le compete); ADMIN/FINANCE
// ven los de todos, para poder armar el cierre de mes con transferencias + tarjeta + facturas.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const receipts = await prisma.cardExpenseReceipt.findMany({
    where: user.role === 'CARDHOLDER' ? { uploadedById: user.id } : undefined,
    include: { uploadedBy: { select: { name: true } }, building: true, category: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const withPreview = await Promise.all(
    receipts.map(async (r) => ({ ...r, previewUrl: await signDocUrl(INVOICES_BUCKET, r.fileUrl) }))
  );

  return NextResponse.json(withPreview);
}

// Sube UN comprobante de gasto de tarjeta a la vez: la persona elige el proveedor (Brex/Jeeves)
// y el edificio (obligatorio, lo decide siempre a mano quien sube el gasto), y la IA intenta
// rellenar monto/fecha/concepto para que no haya que capturarlos. Si la IA falla o se equivoca,
// se puede corregir después con PATCH /api/card-receipts/[id] — nunca bloquea la subida.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (user.role === 'VIEWER') {
    return NextResponse.json({ error: 'Tu acceso es de solo lectura.' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file es requerido' }, { status: 400 });
  }

  const provider = form.get('provider');
  if (typeof provider !== 'string' || !PROVIDERS.includes(provider as any)) {
    return NextResponse.json({ error: 'provider debe ser BREX o JEEVES' }, { status: 400 });
  }

  const buildingId = form.get('buildingId');
  if (typeof buildingId !== 'string' || !buildingId) {
    return NextResponse.json({ error: 'buildingId es requerido — elige el edificio del gasto' }, { status: 400 });
  }
  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building) return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 400 });

  const categoryId = form.get('categoryId');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `gastos-tarjeta/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage.from(INVOICES_BUCKET).upload(path, buffer, {
      contentType: file.type,
    });
    if (uploadError) {
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 400 });
    }

    let fields: ExtractedReceiptFields = {};
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
        fields = text.trim().length > 20 ? await extractReceiptFromText(text) : await extractReceiptFromPdf(buffer.toString('base64'));
      } else if (file.type.startsWith('image/')) {
        fields = await extractReceiptFromImage(buffer.toString('base64'));
      }
    } catch {
      fields = {};
    }

    const receipt = await prisma.cardExpenseReceipt.create({
      data: {
        uploadedById: user.id,
        provider: provider as 'BREX' | 'JEEVES',
        fileUrl: path,
        fileName: file.name,
        amount: fields.amount ?? null,
        expenseDate: fields.date ? new Date(fields.date) : null,
        description: fields.description || null,
        extractedFields: JSON.stringify(fields),
        buildingId,
        categoryId: typeof categoryId === 'string' && categoryId ? categoryId : null,
      },
      include: { building: true, category: true },
    });

    await logAudit(user.id, 'upload', 'CardExpenseReceipt', receipt.id, `${provider} · ${building.name}`);

    return NextResponse.json(receipt, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
