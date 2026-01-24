import type { PrismaClient } from "../../generated/prisma/client.js";

export async function cleanupIdempotencyKeys(prisma: PrismaClient) {
  const now = new Date();
  const res = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return { deleted: res.count };
}
