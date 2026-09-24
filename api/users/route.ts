import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { logAudit } from '@/lib/audit';

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'theblueground.com';
const ROLES = ['ADMIN', 'FINANCE', 'VIEWER'];

// Only an ADMIN can pre-provision a new user (this is the "yo controlo quién
// entra" flow — no self-registration once at least one user exists, see
// lib/currentUser.ts).
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const role = ROLES.includes(body.role) ? body.role : 'FINANCE';

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return NextResponse.json({ error: `El correo debe ser @${ALLOWED_DOMAIN}` }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 });
  }

  const user = await prisma.user.create({ data: { email, name, role } });
  await logAudit(me.id, 'create', 'User', user.id, `${user.email} (${user.role})`);

  return NextResponse.json(user, { status: 201 });
}
