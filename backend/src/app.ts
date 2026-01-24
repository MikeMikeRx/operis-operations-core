import Fastify from "fastify";

// Plugins
import requestContextPlugin from "./plugins/requestContext.js";
import tenantContextPlugin from "./plugins/tenantContext.js";
import userContextPlugin from "./plugins/userContext.js";
import idempotencyPlugin from "./plugins/idempotency.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import swaggerPlugin from "./plugins/swagger.js";
import dbPlugin from "./plugins/db.js";

// Routes
import { productsRoutes } from "./routes/products.js";

// App factory for server and tests
export function buildApp() {
  const app = Fastify({
    logger: {
      level: "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty" }
          : undefined,
    },
  });

  // --- Core plugins ---
  app.register(requestContextPlugin); // request ID, base logger
  app.register(dbPlugin);             // Prisma client
  app.register(tenantContextPlugin);  // x-tenant-id extraction
  app.register(userContextPlugin);    // x-user-id extraction

  // --- Security & protection ---
  app.register(rateLimitPlugin);      // per-tenant rate limits
  app.register(idempotencyPlugin);    // safe write retries

  // --- Documentation ---
  app.register(swaggerPlugin);        // OpenAPI docs at /docs

  // --- Business routes ---
  app.register(productsRoutes);       // /v1/products

  // --- System routes ---
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

  return app;
}
