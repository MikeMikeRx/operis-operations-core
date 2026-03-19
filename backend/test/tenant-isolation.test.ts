import request from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../src/app.js";
import { tenantDb } from "../src/db/tenant.js";
import { beforeAll, afterAll, it, expect, vi } from "vitest";

let app: any;
let tenantAId: string;
let tokenA: string;
let tenantBId: string;
let tokenB: string;
let tenantBProductId: string;

beforeAll(async () => {
  process.env.JWT_EXPIRES_IN = "15m";
  process.env.REFRESH_DAYS = "14";

  app = buildApp();
  await app.ready();

  const password = "password123";
  const passwordHash = await bcrypt.hash(password, 12);

  const tenantA = await app.prisma.tenant.create({ data: { name: "Tenant A" } });
  const roleA = await app.prisma.role.create({
    data: {
      tenantId: tenantA.id,
      name: "ADMIN",
      permissions: [
        "product:read", 
        "product:write",
        "stockmovement:read",
        "stockmovement:write",
        "audit:read"
      ],
    },
  });
  await app.prisma.user.create({
    data: { tenantId: tenantA.id, roleId: roleA.id, email: "user@tenant-a.com", passwordHash },
  });
  tenantAId = tenantA.id;

  const loginA = await request(app.server)
    .post("/api/v1/auth/login")
    .send({ tenantId: tenantAId, email: "user@tenant-a.com", password })
    .expect(200);
  tokenA = loginA.body.accessToken;

  const tenantB = await app.prisma.tenant.create({ data: { name: "Tenant B" } });
  const roleB = await app.prisma.role.create({
    data: {
      tenantId: tenantB.id,
      name: "ADMIN",
      permissions: [
        "product:read",
        "product:write",
        "stockmovement:read",
        "stockmovement:write",
        "audit:read"
      ],
    },
  });
  await app.prisma.user.create({
    data: { tenantId: tenantB.id, roleId: roleB.id, email: "user@tenant-b.com", passwordHash },
  });
  tenantBId = tenantB.id;

  const loginB = await request(app.server)
    .post("/api/v1/auth/login")
    .send({ tenantId: tenantBId, email: "user@tenant-b.com", password })
    .expect(200);
  tokenB = loginB.body.accessToken;

  const productB = await app.prisma.product.create({
    data: { tenantId: tenantBId, name: "Tenant B Product", sku: "SKU-B-SEED" },
  });
  tenantBProductId = productB.id;
});

afterAll(async () => {
  await app.close();
});

it("Tenant A token cannot see Tenant B products in list", async () => {
  await request(app.server)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${tokenA}`)
    .set("Idempotency-Key", "isolation-seed-a")
    .send({ name: "Tenant A Product", sku: "SKU-A-1" })
    .expect(201);

  const res = await request(app.server)
    .get("/api/v1/products")
    .set("Authorization", `Bearer ${tokenA}`)
    .expect(200);

  const ids: string[] = res.body.map((p: any) => p.id);
  expect(ids).not.toContain(tenantBProductId);
});

it("Tenant A token cannot update a Tenant B product — returns 404", async () => {
  await request(app.server)
    .patch(`/api/v1/products/${tenantBProductId}`)
    .set("Authorization", `Bearer ${tokenA}`)
    .set("Idempotency-Key", "cross-tenant-patch-1")
    .send({ name: "Hijacked" })
    .expect(404);
});

it("Tenant A token cannot delete a Tenant B product — returns 404", async () => {
  await request(app.server)
    .delete(`/api/v1/products/${tenantBProductId}`)
    .set("Authorization", `Bearer ${tokenA}`)
    .set("Idempotency-Key", "cross-tenant-delete-1")
    .expect(404);

  const stillExists = await app.prisma.product.findUnique({ where: { id: tenantBProductId } });
  expect(stillExists).not.toBeNull();
  expect(stillExists!.deletedAt).toBeNull();
});

it("Tenant A credentials rejected when logging in under Tenant B", async () => {
  await request(app.server)
    .post("/api/v1/auth/login")
    .send({ tenantId: tenantBId, email: "user@tenant-a.com", password: "password123" })
    .expect(401);
});

it("Tenant B credentials rejected when logging in under Tenant A", async () => {
  await request(app.server)
    .post("/api/v1/auth/login")
    .send({ tenantId: tenantAId, email: "user@tenant-b.com", password: "password123" })
    .expect(401);
});

it("forged JWT with Tenant B userId but Tenant A tenantId is rejected by requirePerm", async () => {
  const tenantBUser = await app.prisma.user.findFirst({
    where: { tenantId: tenantBId },
    select: { id: true, roleId: true },
  });

  const craftedToken = await app.jwt.sign({
    tenantId: tenantAId,
    userId: tenantBUser!.id,
    roleId: tenantBUser!.roleId,
  });

  await request(app.server)
    .get("/api/v1/products")
    .set("Authorization", `Bearer ${craftedToken}`)
    .expect(401);
});

it("same Idempotency-Key used by both tenants does not collide", async () => {
  const sharedKey = "shared-idem-key-xyz";

  const resA = await request(app.server)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${tokenA}`)
    .set("Idempotency-Key", sharedKey)
    .send({ name: "Product A Idem", sku: "SKU-IDEM-A" })
    .expect(201);

  const resB = await request(app.server)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${tokenB}`)
    .set("Idempotency-Key", sharedKey)
    .send({ name: "Product B Idem", sku: "SKU-IDEM-B" })
    .expect(201);

  expect(resB.body.id).not.toEqual(resA.body.id);
  expect(resB.body.sku).toBe("SKU-IDEM-B");
});

it("tenantDb always injects tenantId even when caller provides a conflicting where clause", async () => {
  const mockFindMany = vi.fn().mockResolvedValue([]);
  const db = tenantDb({ product: { findMany: mockFindMany } } as any, "tenant-A");

  await db.product.findMany({ where: { tenantId: "tenant-B" } });

  expect(mockFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-A" }),
    })
  );
});

it("tenantDb create always stamps tenantId onto new records", async () => {
  const mockCreate = vi.fn().mockResolvedValue({});
  const db = tenantDb({ product: { create: mockCreate } } as any, "tenant-A");

  await db.product.create({ name: "X", sku: "X" });

  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ tenantId: "tenant-A" }),
    })
  );
});
