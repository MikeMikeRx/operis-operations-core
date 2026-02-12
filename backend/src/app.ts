import Fastify from "fastify";
import cookie from "@fastify/cookie";

import requestContextPlugin from "./plugins/requestContext.js";
import idempotencyPlugin from "./plugins/idempotency.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import apiAuthGuardPlugin from "./plugins/apiAuthGuard.js";
import swaggerPlugin from "./plugins/swagger.js";
import jwtPlugin from "./plugins/jwt.js";
import dbPlugin from "./plugins/db.js";

import { productsRoutes } from "./routes/products.js";
import { authRoutes } from "./routes/auth.js";

export function buildApp() {
  const app = Fastify({
    trustProxy: true,
    logger: {
      level: "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty" }
          : undefined,
    },
  });

  app.register(requestContextPlugin);
  app.register(dbPlugin);
  app.register(jwtPlugin);
  app.register(apiAuthGuardPlugin);
  app.register(rateLimitPlugin);
  app.register(idempotencyPlugin);
  app.register(swaggerPlugin);
  app.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? process.env.JWT_SECRET,
    hook: "onRequest",
  });

  app.register(authRoutes, {prefix: "/api/v1" });
  app.register(productsRoutes, { prefix: "/api/v1" });


  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
          },
        },
      },
    },
    async () => ({ ok: true }),
  );

  app.get(
    "/api/v1/meta", async () => ({
      version: "v1",
      commit: process.env.GIT_COMMIT ?? "unknown",
      builtAt: process.env.BUILD_TIME ?? "unknown",
    })
  );

  return app;
}
