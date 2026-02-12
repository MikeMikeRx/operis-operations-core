import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";

export default fp(async function (app: FastifyInstance) {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  await app.register(rateLimit, {
    redis,
    global: false,
    keyGenerator: (req) => {
      const tenantId = req.auth?.tenantId;
      return tenantId ? `tenant:${tenantId}` : req.ip;
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });

  app.addHook("onClose", async () => {
    await redis.quit();
  });
});
