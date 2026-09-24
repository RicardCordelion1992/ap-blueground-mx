import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

// Supabase Auth owns the login/session; our own Prisma `User` table owns
// app-level identity (role, and being the author of invoices/documents/audit
// entries). This bridges the two: given the logged-in Supabase user, find or
// create the matching Prisma User row (first user ever created becomes ADMIN).
export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  let user = await prisma.user.findUnique({ where: { email: authUser.email } });

  if (!user) {
    const userCount = await prisma.user.count();
    user = await prisma.user.create({
      data: {
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email.split('@')[0],
        role: userCount === 0 ? 'ADMIN' : 'FINANCE',
      },
    });
  }

  return user;
}
