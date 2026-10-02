import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

const ROLES = ['ADMIN', 'FINANCE', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

// Update a user's role, active flag, and/or password. ADMIN-only for role
// and active, and an admin can't change their own role/access here — a
// deliberate guard against locking yourself out (have another admin do it,
// or edit it directly in Supabase). Resetting a password is not a
// privilege-escalation risk, so it's allowed for your own account too.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const isSelf = params.id === me.id;

  if (typeof body.password === 'string') {
    const password = body.password.trim();
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    if (isSelf) {
      // Changing your own password uses your live session, not the admin API.
      const supabase = createClient();
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      if (data.user && me.authUserId !== data.user.id) {
        await prisma.user.update({ where: { id: me.id }, data: { authUserId: data.user.id } });
      }
    } else {
      const target = await prisma.user.findUnique({ where: { id: params.id } });
      if (!target) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      if (!target.authUserId) {
        return NextResponse.json(
          { error: 'Este usuario todavía no tiene un acceso de inicio de sesión creado.' },
          { status: 400 }
        );
      }
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.updateUserById(target.authUserId, { password });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAudit(me.id, 'password_reset', 'User', params.id, isSelf ? 'propia' : 'otro usuario');
    return NextResponse.json({ ok: true });
  }

  if (isSelf) {
    return NextResponse.json({ error: 'No puedes cambiar tu propio acceso desde aquí.' }, { status: 400 });
  }

  const data: { role?: Role; active?: boolean } = {};
  if (ROLES.includes(body.role)) data.role = body.role as Role;
  if (typeof body.active === 'boolean') data.active = body.active;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id: params.id }, data });
  await logAudit(me.id, 'update', 'User', user.id, `role=${user.role} active=${user.active}`);

  return NextResponse.json(user);
}
