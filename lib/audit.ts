import { prisma } from '@/lib/prisma';

export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  detail?: string
) {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, detail },
  });
}
