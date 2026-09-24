import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { redirect } from 'next/navigation';
import UsersClient from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') redirect('/');

  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <p className="text-sm text-gray-500">
          Da de alta a las personas que pueden entrar a la plataforma y define su nivel de acceso.
        </p>
      </div>
      <UsersClient
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        currentUserId={me.id}
      />
    </div>
  );
}
