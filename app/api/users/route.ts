import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

const ROLES = ['ADMIN', 'FINANCE', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

// Only an ADMIN can pre-provision a new user (this is the "yo controlo quién
// entra" flow — no self-registration once at least one user exists, see
// lib/currentUser.ts). Any email domain is accepted: access is controlled
// entirely by who gets created here, not by the domain of their email.
//
// The admin does NOT set a password here — Supabase emails the new person
// an invite link (same /auth/callback -> /reset-password screen used by
// /forgot-password) that lets THEM create their own password. The admin's
// power stays limited to who gets an account, their role, and turning
// access on/off — never seeing or setting anyone else's password.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const role: Role = ROLES.includes(body.role) ? body.role : 'FINANCE';

  if (!email) {
    return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 });
  }

  // Create the login identity in Supabase Auth and email them an invite to
  // set their own password...
  const admin = createAdminClient();
  const redirectTo = new URL('/auth/callback?next=/reset-password', req.url).toString();
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: authError?.message || 'No se pudo enviar la invitación.' },
      { status: 400 }
    );
  }

  // ...then the app-level record that controls role/access.
  // authUserId is cast via "as any" — see note in app/api/users/[id]/route.ts.
  const user = await prisma.user.create({
    data: { email, name, role, authUserId: authData.user.id } as any,
  });
  await logAudit(me.id, 'create', 'User', user.id, `${user.email} (${user.role})`);

  return NextResponse.json(user, { status: 201 });
}
