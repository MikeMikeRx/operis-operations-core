import type { PrismaClient } from "../../generated/prisma/client.js";

export async function purgeSoftDeletedProducts(prisma: PrismaClient) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const res = await prisma.product.deleteMany({
    where: {
      deletedAt: { lt: cutoff },
    },
  });

  return { deleted: res.count };
}
