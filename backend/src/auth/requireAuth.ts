import type { FastifyReply, FastifyRequest } from "fastify";

interface JwtPayload {
  tenantId: string;
  userId: string;
  roleId: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    auth: JwtPayload;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }

  const { tenantId, userId, roleId } = req.user;
  if (!tenantId || !userId || !roleId) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  req.auth = { tenantId, userId, roleId };
  req.log = req.log.child({ tenantId, userId });
}
