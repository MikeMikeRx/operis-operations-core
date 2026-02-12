import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/requireAuth.js";
import { requirePerm } from "../auth/rbac.js";
import { tenantDb } from "../db/tenant.js";
import { CreateProductBody, UpdateProductBody, type CreateProductBodyType, type UpdateProductBodyType } from "./product.schemas.js";
import { writeAudit } from "../audit/audit.js";

interface ProductQuery { limit?: number }
interface ProductParams { id: string }

export async function productsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ProductQuery }>(
    "/products",
    {
      preHandler: [requireAuth, requirePerm("product:read")],
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
      schema: {
        tags: ["products"],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (req) => {
      const { auth } = req;
      if (!auth) throw new Error("unreachable: auth missing");

      const raw = req.query.limit;
      const parsed = typeof raw === "number" ? raw : Number(raw ?? 20);
      const limit = Number.isFinite(parsed) ? Math.min(parsed, 100) : 20;

      const db = tenantDb(app.prisma, auth.tenantId);

      return db.product.findMany({ take: limit, orderBy: { createdAt: "desc" } });
    }
  );

  app.post<{ Body: CreateProductBodyType }>(
    "/products",
    {
      preHandler: [requireAuth, requirePerm("product:write")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: { tags: ["products"] },
    },
    async (req, reply) => {
      const { auth } = req;
      if (!auth) throw new Error("unreachable: auth missing");

      const body = CreateProductBody.parse(req.body);
      const db = tenantDb(app.prisma, auth.tenantId);

      const created = await db.product.create(body);

      await writeAudit(app.prisma, {
        tenantId: auth.tenantId,
        actorId: auth.userId,
        action: "product.create",
        entity: "Product",
        entityId: created.id,
        meta: { sku: created.sku },
      });

      return reply.code(201).send(created);
    }
  );

  app.patch<{ Params: ProductParams; Body: UpdateProductBodyType }>(
    "/products/:id",
    {
      preHandler: [requireAuth, requirePerm("product:write")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["products"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 1} },
        },
      },
    },
    async (req, reply) => {
      const { auth } = req;
      if (!auth) throw new Error("unreachable: auth missing");

      const { id } = req.params;
      const body = UpdateProductBody.parse(req.body);

      const db = tenantDb(app.prisma, auth.tenantId);

      const res = await db.product.updateMany({
        where: { id },
        data: body,
      });

      if (res.count === 0) return reply.code(404).send({ error: "not found" });

      const updated = await db.product.findFirst({ where: { id } });
      if (!updated) return reply.code(404).send({ error: "not found" });

      await writeAudit(app.prisma, {
        tenantId: auth.tenantId,
        actorId: auth.userId,
        action: "product.update",
        entity: "Product",
        entityId: id,
        meta: body,
      });

      return reply.code(200).send(updated);
    }
  );

  app.delete<{ Params: ProductParams }>(
    "/products/:id",
    {
      preHandler: [requireAuth, requirePerm("product:write")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["products"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 1 } },
        },
      },
    },
    async (req, reply) => {
      const { auth } = req;
      if (!auth) throw new Error("unreachable: auth missing");

      const { id } = req.params;

      const db = tenantDb(app.prisma, auth.tenantId);

      const res = await db.product.updateMany({
        where: { id },
        data: { deletedAt: new Date() },
      });

      if (res.count === 0) return reply.code(404).send({ error: "not found" });

      await writeAudit(app.prisma, {
        tenantId: auth.tenantId,
        actorId: auth.userId,
        action: "product.delete",
        entity: "Product",
        entityId: id,
      });

      return reply.code(200).send({ deleted: true, id });
    }
  );
}
