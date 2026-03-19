import type { FastifyInstance } from "fastify";
import { requirePerm } from "../auth/rbac.js";
import { tenantDb } from "../db/tenant.js";
import { writeAudit } from "../audit/audit.js";
import {
    CreateStockMovementBody,
    type CreateStockMovementBodyType,
} from "./stockMovement.schemas.js";

interface MovementQuery {
    limit?: number;
    productId?: string;
}

interface MovementParams {
    id: string;
}

const movementResponse = {
    type: "object",
    properties: {
        id: { type: "string" },
        productId: { type: "string" },
        type: { type: "string" },
        quantity: { type: "integer" },
        reason: { type: "string", nullable: true },
        reference: { type: "string", nullable: true },
        createdBy: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time" },
    },
} as const;

const errorResponse = {
    type: "object",
    required: ["error"],
    properties: {
        error: { type: "string" },
    },
} as const;

export async function stockMovementsRoutes(app: FastifyInstance) {
    app.post<{ Body: CreateStockMovementBodyType }>(
        "/stock-movements",
        {
            preHandler: [requirePerm("stockmovement:write")],
            config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
            schema: {
                tags: ["stock-movements"],
                response: { 201: movementResponse },
            },
        },
        async (req, reply) => {
            const { auth } = req;
            if (!auth) throw new Error("unreachable: auth missing");

            const body = CreateStockMovementBody.parse(req.body);
            const db = tenantDb(app.prisma, auth.tenantId);

            const created = await db.stockMovement.create({
                ...body,
                createdBy: auth.userId,
            });

            await writeAudit(app.prisma, {
                tenantId: auth.tenantId,
                actorId: auth.userId,
                action: "stockmovement.create",
                entity: "StockMovement",
                entityId: created.id,
                meta: {
                    productId: created.productId,
                    type: created.type,
                    quantity: created.quantity,
                },
            });

            return reply.code(201).send(created);
        }
    );

    app.get<{ Querystring: MovementQuery }>(
        "/stock-movements",
        {
            preHandler: [requirePerm("stockmovement:read")],
            config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
            schema: {
                tags: ["stock-movements"],
                querystring: {
                    type: "object",
                    properties: {
                        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
                        productId: { type: "string" },
                    },
                },
                response: {
                    200: { type: "array", items: movementResponse },
                },
            },
        },
        async (req) => {
            const { auth } = req;
            if (!auth) throw new Error("unreachable: auth missing");

            const { limit = 20, productId } = req.query;
            const db = tenantDb(app.prisma, auth.tenantId);

            return db.stockMovement.findMany({
                where: {
                    ...(productId ? { productId } : {}),
                },
                take: limit,
                orderBy: { createdAt: "desc" },
            });
        }
    );

    app.get<{ Params: MovementParams }>(
        "/stock-movements/:id",
        {
            preHandler: [requirePerm("stockmovement:read")],
            config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
            schema: {
                tags: ["stock-movements"],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: { type: "string", minLength: 1 },
                    },
                },
                response: {
                    200: movementResponse,
                    404: errorResponse,
                },
            },
        },
        async (req, reply) => {
            const { auth } = req;
            if (!auth) throw new Error("unreachable: auth missing");

            const db = tenantDb(app.prisma, auth.tenantId);

            const movement = await db.stockMovement.findFirst({
                where: {
                    id: req.params.id,
                },
            });

            if (!movement) {
                return reply.code(404).send({ error: "not found" });
            }

            return reply.code(200).send(movement);
        }
    );
}
