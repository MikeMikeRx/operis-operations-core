import type { PrismaClient } from "../../generated/prisma/client.js";

export async function purgeAuditLogs(prisma: PrismaClient) {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const res = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  return { deleted: res.count };
}
