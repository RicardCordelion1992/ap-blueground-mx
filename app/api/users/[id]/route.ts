import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

const ROLES = ['ADMIN', 'FINANCE', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

// Update a user's role, active flag, resend their invite, or change your
// OWN password. ADMIN-only for role and active, and an admin can't change
// their own role/access here — a deliberate guard against locking yourself
// out (have another admin do it, or edit it directly in Supabase).
//
// Deliberate design: an admin can create accounts, set roles, and turn
// access on/off, but can NOT set or see another person's password — only
// that person can, via the invite email or /forgot-password. If someone
// loses their invite or forgets their password, the admin's only lever is
// `resendInvite`, which re-sends them a link to set it themselves.
//
// NOTE: authUserId reads/writes below are cast through "as any" — some
// Vercel builds have shown Prisma's generated types lagging one deploy
// behind a fresh schema field even though the column itself is live in the
// database (confirmed via "prisma db push"). The cast only affects
// compile-time checking, not runtime behavior.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const isSelf = params.id === me.id;

  // Changing your OWN password uses your live session, not the admin API —
  // this is the one password action an admin can still do directly.
  if (typeof body.password === 'string') {
    if (!isSelf) {
      return NextResponse.json(
        {
          error:
            'Ya no se puede establecer la contraseña de otra persona aquí — usa "Reenviar invitación" para que ella misma la cree.',
        },
        { status: 400 }
      );
    }

    const password = body.password.trim();
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const meAny = me as any;
    if (data.user && meAny.authUserId !== data.user.id) {
      await prisma.user.update({ where: { id: me.id }, data: { authUserId: data.user.id } as any });
    }

    await logAudit(me.id, 'password_reset', 'User', params.id, 'propia');
    return NextResponse.json({ ok: true });
  }

  // Re-send the invite / set-password link for someone else — never sets a
  // password directly. Works whether they never opened the first invite or
  // already have a password and are locked out (it falls back to a normal
  // password-recovery link in that case, the same one /forgot-password sends).
  if (body.resendInvite === true) {
    if (isSelf) {
      return NextResponse.json({ error: 'Usa /forgot-password para tu propia cuenta.' }, { status: 400 });
    }
    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const admin = createAdminClient();
    const redirectTo = new URL('/auth/callback?next=/reset-password', req.url).toString();
    let { error } = await admin.auth.admin.inviteUserByEmail(target.email, { redirectTo });
    if (error) {
      const retry = await admin.auth.resetPasswordForEmail(target.email, { redirectTo });
      error = retry.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAudit(me.id, 'resend_invite', 'User', params.id, target.email);
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
