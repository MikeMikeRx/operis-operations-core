import type { FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "../generated/prisma/client.js";

export function requirePerm(perm: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const app = req.server;
    const prisma: PrismaClient = (app as any).prisma;

    const user = await prisma.user.findFirst({
      where: { id: (req as any).userId, tenantId: (req as any).tenantId },
      select: { role: { select: { permissions: true } } },
    });

    if (!user) return reply.code(401).send({ error: "invalid user" });

    const ok = user.role.permissions.includes(perm);
    if (!ok) return reply.code(403).send({ error: "forbidden" });
  };
}
