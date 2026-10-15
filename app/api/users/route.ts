import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

const ROLES = ['ADMIN', 'FINANCE', 'VIEWER', 'CARDHOLDER'] as const;
type Role = (typeof ROLES)[number];

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = ROLES.includes(body.role) ? (body.role as Role) : null;
  const password = typeof body.password === 'string' ? body.password.trim() : '';

  if (!email) return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  if (!role) return NextResponse.json({ error: 'El rol no es válido' }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese correo.' }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || 'No se pudo crear la cuenta de acceso.' },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        active: true,
        authUserId: data.user.id,
      } as any,
    });

    await logAudit(me.id, 'create', 'User', user.id, `${user.email} (${user.role})`);

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    // Si falla al guardar en la base, borramos la cuenta de acceso para no dejarla huérfana.
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: 'No se pudo guardar el usuario en la base de datos.' }, { status: 500 });
  }
}
