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
      create: async (data: Omit<Prisma.ProductUncheckedCreateInput, "tenantId">) => {
        try {
          return await prisma.product.create({
            data: { ...data, tenantId }
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            throw new Error("SKU_ALREADY_EXIST");
          }
          throw err;
        }
      },
      update: (args: { where: { id: string }; data: Prisma.ProductUpdateInput }) =>
        prisma.product.update({
          where: { id: args.where.id, tenantId, deletedAt: null },
          data: args.data,
        }),
      updateMany: (args: { where: Prisma.ProductWhereInput; data: Prisma.ProductUpdateInput }) =>
        prisma.product.updateMany({
          where: { ...args.where, tenantId, deletedAt: null },
          data: args.data,
        }),
    },
  };
}
