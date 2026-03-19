import request from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../src/app.js";

let app: any;
let token: string;
let restrictedToken: string;
let productId: string;
let createdIds: string[] = [];

beforeAll(async () => {
  process.env.JWT_EXPIRES_IN = "15m";
  process.env.REFRESH_DAYS = "14";

  app = buildApp();
  await app.ready();

  const password = "password123";
  const passwordHash = await bcrypt.hash(password, 12);

  const tenant = await app.prisma.tenant.create({
    data: { name: "StockMovement Test Tenant" },
  });

  const role = await app.prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "STOCK_ADMIN",
      permissions: ["stockmovement:read", "stockmovement:write"],
    },
  });

  const restrictedRole = await app.prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "STOCK_READONLY",
      permissions: ["stockmovement:read"],
    },
  });

  await app.prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: role.id,
      email: "stock-admin@example.com",
      passwordHash,
    },
  });

  await app.prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: restrictedRole.id,
      email: "stock-readonly@example.com",
      passwordHash,
    },
  });

  const product = await app.prisma.product.create({
    data: { tenantId: tenant.id, name: "Test Product", sku: "SKU-SM-1" },
  });
  productId = product.id;

  const loginRes = await request(app.server)
    .post("/api/v1/auth/login")
    .send({ tenantId: tenant.id, email: "stock-admin@example.com", password })
    .expect(200);

  token = loginRes.body.accessToken;
  if (!token) throw new Error("Login did not return accessToken!");

  const restrictedLoginRes = await request(app.server)
    .post("/api/v1/auth/login")
    .send({ tenantId: tenant.id, email: "stock-readonly@example.com", password })
    .expect(200);

  restrictedToken = restrictedLoginRes.body.accessToken;
  if (!restrictedToken) throw new Error("Restricted login did not return accessToken!");
});

afterAll(async () => {
  await app.close();
});

it("POST /stock-movements → 201 (type: IN, quantity: 10)", async () => {
  const res = await request(app.server)
    .post("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "sm-test-in-001")
    .send({ productId, type: "IN", quantity: 10 })
    .expect(201);

  expect(res.body.id).toBeDefined();
  expect(res.body.type).toBe("IN");
  expect(res.body.quantity).toBe(10);
  createdIds.push(res.body.id);
});

it("POST /stock-movements → 201 (type: OUT, quantity: 5)", async () => {
  const res = await request(app.server)
    .post("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "sm-test-out-001")
    .send({ productId, type: "OUT", quantity: 5 })
    .expect(201);

  expect(res.body.type).toBe("OUT");
  expect(res.body.quantity).toBe(5);
  createdIds.push(res.body.id);
});

it("POST /stock-movements → 201 (type: ADJUST, quantity: 3, reason: 'inventory count')", async () => {
  const res = await request(app.server)
    .post("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "sm-test-adjust-001")
    .send({ productId, type: "ADJUST", quantity: 3, reason: "inventory count" })
    .expect(201);

  expect(res.body.type).toBe("ADJUST");
  expect(res.body.reason).toBe("inventory count");
  createdIds.push(res.body.id);
});

it("POST /stock-movements → 201 (type: TRANSFER, reference: 'WH-A → WH-B')", async () => {
  const res = await request(app.server)
    .post("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "sm-test-transfer-001")
    .send({ productId, type: "TRANSFER", quantity: 7, reference: "WH-A → WH-B" })
    .expect(201);

  expect(res.body.type).toBe("TRANSFER");
  expect(res.body.reference).toBe("WH-A → WH-B");
  createdIds.push(res.body.id);
});

it("GET /stock-movements → 200, array of 4", async () => {
  const res = await request(app.server)
    .get("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThanOrEqual(4);
});

it("GET /stock-movements?productId=X → 200, filtered", async () => {
  const res = await request(app.server)
    .get(`/api/v1/stock-movements?productId=${productId}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBe(4);
  for (const m of res.body) {
    expect(m.productId).toBe(productId);
  }
});

it("GET /stock-movements/:id → 200", async () => {
  const id = createdIds[0];
  const res = await request(app.server)
    .get(`/api/v1/stock-movements/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

  expect(res.body.id).toBe(id);
});

it("GET /stock-movements/nonexistent → 404", async () => {
  await request(app.server)
    .get("/api/v1/stock-movements/nonexistent-id-000")
    .set("Authorization", `Bearer ${token}`)
    .expect(404);
});

it("POST without stockmovement:write permission → 403", async () => {
  await request(app.server)
    .post("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${restrictedToken}`)
    .set("Idempotency-Key", "sm-test-forbidden-001")
    .send({ productId, type: "IN", quantity: 1 })
    .expect(403);
});

it("POST without Idempotency-Key header → 400", async () => {
  await request(app.server)
    .post("/api/v1/stock-movements")
    .set("Authorization", `Bearer ${token}`)
    .send({ productId, type: "IN", quantity: 1 })
    .expect(400);
});
