import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

// Descartar una factura recibida por correo que no se va a capturar (spam,
// duplicado, no era una factura). Requiere sesión — cualquier usuario que
// pueda capturar facturas puede limpiar la Bandeja, no solo un ADMIN.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();

  if (body.discard) {
    const email = await prisma.inboundInvoiceEmail.update({
      where: { id: params.id },
      data: { status: 'DISCARDED', discardedReason: body.reason || null },
    });
    return NextResponse.json(email);
  }

  return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
}
