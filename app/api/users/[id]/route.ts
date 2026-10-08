import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

const ROLES = ['ADMIN', 'FINANCE', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

// Update a user's role, active flag, or password. ADMIN-only for role and
// active, and an admin can't change their own role/access here — a
// deliberate guard against locking yourself out (have another admin do it,
// or edit it directly in Supabase).
//
// Password: an admin can set/reset ANYONE's password directly here — no
// outgoing email required. Each person can also change their own password
// any time, or use /forgot-password if they forget it and no admin is
// around.
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

  if (typeof body.password === 'string') {
    const password = body.password.trim();
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    // Changing your OWN password uses your live session.
    if (isSelf) {
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

    // Setting someone else's password uses the Supabase admin API directly.
    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    const targetAny = target as any;
    if (!targetAny.authUserId) {
      return NextResponse.json(
        { error: 'Este usuario no tiene una cuenta de acceso vinculada.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(targetAny.authUserId, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAudit(me.id, 'password_reset', 'User', params.id, target.email);
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

// Permanently delete a user. ADMIN-only, and an admin can't delete
// themselves (same self-lockout guard as above — have another admin do it).
//
// A hard delete is only allowed when the user has NO associated history
// (no invoices they captured or approved, no uploaded vendor documents, no
// audit-log activity) — deleting a row that other records point to would
// either fail at the database level or silently orphan that history. If
// the person has any history, they can't be deleted: the admin should use
// "Desactivar" instead, which blocks their access immediately while
// keeping their history intact. This mirrors how the rest of the app
// treats historical data (facturas, documentos) as something to preserve,
// not erase.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (params.id === me.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta.' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const [invoicesCreated, invoicesApproved, documentsUploaded, auditLogs] = await Promise.all([
    prisma.invoice.count({ where: { createdById: params.id } }),
    prisma.invoice.count({ where: { approvedById: params.id } }),
    prisma.vendorDocument.count({ where: { uploadedById: params.id } }),
    prisma.auditLog.count({ where: { userId: params.id } }),
  ]);

  if (invoicesCreated > 0 || invoicesApproved > 0 || documentsUploaded > 0 || auditLogs > 0) {
    return NextResponse.json(
      {
        error:
          'Este usuario tiene historial asociado (facturas, documentos o actividad registrada) y no se puede eliminar sin perder ese rastro. Usa "Desactivar" en su lugar — bloquea su acceso de inmediato y conserva su historial.',
      },
      { status: 409 }
    );
  }

  const targetAny = target as any;
  if (targetAny.authUserId) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(targetAny.authUserId);
  }

  await prisma.user.delete({ where: { id: params.id } });
  await logAudit(me.id, 'delete', 'User', params.id, target.email);

  return NextResponse.json({ ok: true });
}
