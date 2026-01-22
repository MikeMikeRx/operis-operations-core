import type { PrismaClient } from "@prisma/client";

export async function writeAudit(prisma: PrismaClient, params: {
  tenantId: string;
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  meta?: any;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      meta: params.meta,
    },
  });
}
