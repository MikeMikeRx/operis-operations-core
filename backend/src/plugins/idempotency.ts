import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

interface CachedResponse {
  statusCode: number;
  body: unknown;
}

interface IdempotencyCtx {
  tenantId: string;
  key: string;
  method: string;
  path: string;
  requestHash: string;
}

declare module "fastify" {
  interface FastifyRequest {
    idempotency?: IdempotencyCtx;
  }
}

export default fp(async function (app: FastifyInstance) {
  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    const method = req.method.toUpperCase();
    
    const rawPath = req.url.split("?")[0];
    if (rawPath === "/api/v1/auth" || rawPath.startsWith("/api/v1/auth/")) return;

    const isWrite = method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
    if (!isWrite) return;

    const key = req.headers["idempotency-key"];
    if (typeof key !== "string" || key.trim().length < 8) {
      return reply.code(400).send({ error: "Idempotency-Key header is required for write requests" });
    }

    const tenantId = req.auth?.tenantId;
    if (!tenantId) return;

    const path = req.routeOptions?.url ?? req.url.split("?")[0];
    const bodyStr = req.body === undefined ? "" : JSON.stringify(req.body);
    const requestHash = sha256(`${method}:${path}:${bodyStr}`);

    const existing = await app.prisma.idempotencyKey.findUnique({
      where: { tenantId_key: { tenantId, key: key.trim() } },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return reply.code(409).send({ error: "Idempotency-Key reused with different request" });
      }

      const cached = existing.response as unknown as CachedResponse;
      const statusCode = cached.statusCode ?? 200;
      const body = cached.body ?? existing.response;

      return reply.code(statusCode).send(body);
    }

    req.idempotency = { tenantId, key: key.trim(), method, path, requestHash };
  });

  app.addHook("onSend", async (req, reply, payload) => {
    if (!req.idempotency) return;

    if (reply.statusCode >= 400) return payload;

    const { tenantId, key, method, path, requestHash } = req.idempotency;

    const responseBody =
      typeof payload === "string" ? safeJsonParse(payload) ?? payload : payload;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      await app.prisma.idempotencyKey.create({
        data: {
          tenantId,
          key,
          method,
          path,
          requestHash,
          response: { statusCode: reply.statusCode, body: responseBody },
          expiresAt,
        },
      });
    } catch (e: unknown) {
      req.log.warn({ err: e }, "idempotency write failed");
    }

    return payload;
  });
});

function safeJsonParse(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
