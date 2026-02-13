import type { FastifyInstance } from "fastify";
import { Prisma } from "../generated/prisma/client.js";
import { requirePerm } from "../auth/rbac.js";
import { tenantDb } from "../db/tenant.js";
import { CreateProductBody, UpdateProductBody, type CreateProductBodyType, type UpdateProductBodyType } from "./product.schemas.js";
import { writeAudit } from "../audit/audit.js";

interface ProductQuery { limit?: number }
interface ProductParams { id: string }

const productResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    sku: { type: "string" },
    name: { type: "string" },
    unit: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const errorResponse = {
  type: "object",
  required: ["error"],
  properties: { error: { type: "string" } },
} as const;

export async function productsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ProductQuery }>(
    "/products",
    {
      preHandler: [requirePerm("product:read")],
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
      schema: {
        tags: ["products"],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: { type: "array", items: productResponse },
        },
      },
    },
    async (req) => {
      const { auth } = req;
      if (!auth) throw new Error("unreachable: auth missing");

      const db = tenantDb(app.prisma, auth.tenantId);

      return db.product.findMany({ take: req.query.limit, orderBy: { createdAt: "desc" } });
    }
  );

  app.post<{ Body: CreateProductBodyType }>(
    "/products",
    {
      preHandler: [requirePerm("product:write")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["products"],
        response: { 201: productResponse },
      },
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
      preHandler: [requirePerm("product:write")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["products"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 1} },
        },
        response: { 200: productResponse, 404: errorResponse },
      },
    },
    async (req, reply) => {
      const { auth } = req;
      if (!auth) throw new Error("unreachable: auth missing");

      const { id } = req.params;
      const body = UpdateProductBody.parse(req.body);

      const db = tenantDb(app.prisma, auth.tenantId);

      let updated;
      try {
        updated = await db.product.update({ where: { id }, data: body });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return reply.code(404).send({ error: "not found" });
        }
        throw err;
      }

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
      preHandler: [requirePerm("product:write")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["products"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 1 } },
        },
        response: { 204: { type: "null" }, 404: errorResponse },
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

      return reply.code(204).send();
    }
  );
}
