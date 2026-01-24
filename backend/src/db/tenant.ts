import { type PrismaClient, Prisma } from "../generated/prisma/client.js";

export function tenantDb(prisma: PrismaClient, tenantId: string) {
  return {
    product: {
      findMany: (args?: Prisma.ProductFindManyArgs) =>
        prisma.product.findMany({
          ...args,
          where: { ...args?.where, tenantId, deletedAt: null },
        }),
      findFirst: (args?: Prisma.ProductFindFirstArgs) =>
        prisma.product.findFirst({
          ...args,
          where: { ...args?.where, tenantId, deletedAt: null },
        }),
      findUniqueBySku: (sku: string) =>
        prisma.product.findUnique({ where: { tenantId_sku: { tenantId, sku } } }),
      create: (data: Omit<Prisma.ProductUncheckedCreateInput, "tenantId">) =>
        prisma.product.create({ data: { ...data, tenantId } }),
      updateMany: (args: { where: Prisma.ProductWhereInput; data: Prisma.ProductUpdateInput }) =>
        prisma.product.updateMany({
          where: { ...args.where, tenantId, deletedAt: null },
          data: args.data,
        }),
    },
    // will expand this object per model over time
  };
}
