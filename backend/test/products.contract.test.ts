import request from "supertest";
import bcrypt from "bcrypt";
import { buildApp } from "../src/app.js";

let app: any;
let tenantId: string;
let token: string;
let refreshCookie: string = "";

function cookieHeaderFromSetCookie(setCookie: string | string[] | undefined): string {
  if (!setCookie?.length) return "";

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

beforeAll(async () => {
  process.env.JWT_EXPIRES_IN = "1s";
  process.env.REFRESH_EXPIRES_DAYS = "14";

  app = buildApp();
  await app.ready();

  const password = "password123"
  const passwordHash = await bcrypt.hash(password, 12);

  const tenant = await app.prisma.tenant.create({
    data: { name: "Test tenant" },
  });

  const role = await app.prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: "TEST",
      permissions: ["product:read", "product:write", "audit:read"],
    },
  });

  const user = await app.prisma.user.create({
    data: {
      tenantId: tenant.id,
      roleId: role.id,
      email: "test@example.com",
      passwordHash,
    },
  });

  tenantId = tenant.id;
  
  const loginRes = await request(app.server)
    .post("/api/v1/auth/login")
    .send({ tenantId, email: "test@example.com", password })
    .expect(200);

  token = loginRes.body.accessToken;
  if(!token) throw new Error("Login did not return accessToken!");

  refreshCookie = cookieHeaderFromSetCookie(loginRes.headers["set-cookie"]);
  if(!refreshCookie) throw new Error("Login did not set refres cookie");

  await new Promise((r) => setTimeout(r, 1100));

  await request(app.server)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "test-key-expired")
    .send({ name: "Fail", sku: "SKU-X" })
    .expect(401);

  const refreshRes = await request(app.server)
    .post("/api/v1/auth/refresh")
    .set("Cookie", refreshCookie)
    .expect(200);

  token = refreshRes.body.accessToken ?? refreshRes.body.token;
  if (!token) throw new Error("Refresh did not return access token");

  const rotatedCookie = cookieHeaderFromSetCookie(refreshRes.headers["set-cookie"]);
  if(rotatedCookie) refreshCookie = rotatedCookie;

  await request(app.server)
    .post("/api/v1/auth/logout")
    .set("Cookie", refreshCookie)
    .expect(200);

  await request(app.server)
    .post("/api/v1/auth/refresh")
    .set("Cookie", refreshCookie)
    .expect(401);
});

afterAll(async () => {
  await app.close();
});

it("creates a product", async () => {
  await request(app.server)
    .post("/api/v1/products")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "test-key-123")
    .send({ name: "Test", sku: "SKU-1" })
    .expect(201);
});
