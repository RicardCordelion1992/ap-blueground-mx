import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

const ROLES = ['ADMIN', 'FINANCE', 'VIEWER'];

// Update a user's role and/or active flag. ADMIN-only, and an admin can't
// change their own access here — that's a deliberate guard against locking
// yourself out; have another admin do it, or edit it directly in Supabase.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (params.id === me.id) {
    return NextResponse.json({ error: 'No puedes cambiar tu propio acceso desde aquí.' }, { status: 400 });
  }

  const body = await req.json();
  const data: { role?: string; active?: boolean } = {};
  if (ROLES.includes(body.role)) data.role = body.role;
  if (typeof body.active === 'boolean') data.active = body.active;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id: params.id }, data });
  await logAudit(me.id, 'update', 'User', user.id, `role=${user.role} active=${user.active}`);

  return NextResponse.json(user);
}
