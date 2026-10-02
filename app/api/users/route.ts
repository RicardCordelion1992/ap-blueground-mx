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
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const password = (body.password || '').trim();
  const role: Role = ROLES.includes(body.role) ? body.role : 'FINANCE';

  if (!email) {
    return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 });
  }

  // Create the real login identity in Supabase Auth first...
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: authError?.message || 'No se pudo crear el acceso de inicio de sesión.' },
      { status: 400 }
    );
  }

  // ...then the app-level record that controls role/access.
  const user = await prisma.user.create({
    data: { email, name, role, authUserId: authData.user.id },
  });
  await logAudit(me.id, 'create', 'User', user.id, `${user.email} (${user.role})`);

  return NextResponse.json(user, { status: 201 });
}
