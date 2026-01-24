import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";

describe("Products API contract", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /v1/products returns 201 with product shape", async () => {
    const sku = `SKU-${Date.now()}`;

    const res = await request(app.server)
      .post("/v1/products")
      .set("x-tenant-id", "t1")
      .set("x-user-id", "u1")
      .set("idempotency-key", `k-${Date.now()}`)
      .send({ sku, name: "Test", unit: "pcs" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      sku,
      name: "Test",
    });
  });
});
