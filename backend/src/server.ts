import Fastify from "fastify";
import requestContextPlugin from "./plugins/requestContext.js";
import tenantContextPlugin from "./plugins/tenantContext.js";
import userContextPlugin from "./plugins/userContext.js";
import swaggerPlugin from "./plugins/swagger.js";
import dbPlugin from "./plugins/db.js";
// import { requirePerm } from "./auth/rbac.js";
import { productsRoutes } from "./routes/product.js";

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
await app.register(requestContextPlugin);
await app.register(dbPlugin);
await app.register(tenantContextPlugin);
await app.register(swaggerPlugin);
await app.register(userContextPlugin);
await app.register(productsRoutes);

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
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
