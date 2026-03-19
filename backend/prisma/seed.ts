import bcrypt from "bcrypt";
import { prisma } from "../src/db/prisma.js";

async function main() {
  const seedPassword = await bcrypt.hash("password123", 12);
  // --- tenant 1 ---
  const t1 = await prisma.tenant.upsert({
    where: { id: "t1" },
    update: {},
    create: {
      id: "t1",
      name: "Test Tenant",
    },
  });

  // --- role ---
  const r1 = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: t1.id, name: "ADMIN" } },
    update: {},
    create: {
      id: "r1",
      tenantId: t1.id,
      name: "ADMIN",
      permissions: ["product:read", "product:write", "stockmovement:read", "stockmovement:write", "audit:read"],
    },
  });

  // --- user ---
  await prisma.user.upsert({
    where: { id: "u1" },
    update: {},
    create: {
      id: "u1",
      email: "user@test.local",
      tenantId: t1.id,
      roleId: r1.id,
      passwordHash: seedPassword,
    },
  });

  // --- products ---
  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      { id: "p1", tenantId: t1.id, sku: "SKU-001", name: "Product One" },
      { id: "p2", tenantId: t1.id, sku: "SKU-002", name: "Product Two" },
    ],
  });

// --- tenant 2 ---
  const t2 = await prisma.tenant.upsert({
    where: { id: "t2" },
    update: {},
    create: { id: "t2", name: "Second Tenant" },
  });

  // --- role 2 ---
  const r2 = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: t2.id, name: "ADMIN" } },
    update: {},
    create: {
      id: "r2",
      tenantId: t2.id,
      name: "ADMIN",
      permissions: ["product:read", "product:write", "stockmovement:read", "stockmovement:write", "audit:read"],
    },
  });

  // --- user 2 ---
  await prisma.user.upsert({
    where: { id: "u2" },
    update: {},
    create: {
      id: "u2",
      email: "user2@test.local",
      tenantId: t2.id,
      roleId: r2.id,
      passwordHash: seedPassword,
    },
  });

  // --- products 2 ---
  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      { id: "p3", tenantId: t2.id, sku: "SKU-101", name: "Tenant2 Product One" },
      { id: "p4", tenantId: t2.id, sku: "SKU-102", name: "Tenant2 Product Two" },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
