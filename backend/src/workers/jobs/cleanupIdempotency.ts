import type { PrismaClient } from "@prisma/client";

export async function cleanupIdempotencyKeys(prisma: PrismaClient) {
  const now = new Date();
  const res = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return { deleted: res.count };
}
