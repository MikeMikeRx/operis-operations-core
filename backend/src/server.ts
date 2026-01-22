import Fastify from "fastify";
import requestContextPlugin from "./plugins/requestContext.js";
import tenantContextPlugin from "./plugins/tenantContext.js";
import userContextPlugin from "./plugins/userContext.js";
import idempotencyPlugin from "./plugins/idempotency.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import swaggerPlugin from "./plugins/swagger.js";
import dbPlugin from "./plugins/db.js";
// import { requirePerm } from "./auth/rbac.js";
import { productsRoutes } from "./routes/products.js";
import { ensureMaintenanceJobs } from "./queues/maintenance.js";

const app = Fastify({
  logger: {
    level: "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty" }
        : undefined,
  },
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

// Register plugins
await app.register(requestContextPlugin); // request id, base logger
await app.register(dbPlugin);             // Prisma
await app.register(tenantContextPlugin);  // x-tenant-id
await app.register(userContextPlugin);    // x-user-id
await app.register(rateLimitPlugin);      // protect API usage
await app.register(idempotencyPlugin);    // protect writes
await app.register(swaggerPlugin);        // docs
await app.register(productsRoutes);       // business routes

// Health route
app.get(
  "/health",
  {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
          },
          required: ["ok"],
        },
      },
    },
  },
  async () => ({ ok: true }),
);

try {
  await app.listen({ port, host });

  // Start background/maintenance jobs AFTER server is up
  await ensureMaintenanceJobs();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
