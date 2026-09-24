import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

// Supabase Auth owns the login/session; our own Prisma `User` table owns
// app-level identity (role, active/revoked, and being the author of
// invoices/documents/audit entries). This bridges the two: given the
// logged-in Supabase user, find the matching Prisma User row.
//
// IMPORTANT: this does NOT self-register arbitrary company emails anymore.
// An administrator has to create the User row first (from /usuarios) —
// that's the "yo controlo quién entra y con qué permiso" requirement.
// The one exception is a completely empty table (brand-new deploy): the
// very first person ever to log in becomes ADMIN, so there's always a way
// to get in and start adding people from the Usuarios screen.
export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;
  const email = authUser.email.toLowerCase();

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const userCount = await prisma.user.count();
    if (userCount > 0) return null; // not provisioned — an admin has to add them first

    user = await prisma.user.create({
      data: {
        email,
        name: authUser.user_metadata?.name || email.split('@')[0],
        role: 'ADMIN',
      },
    });
  }

  if (!user.active) return null;

  return user;
}
