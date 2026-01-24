import { prisma } from "../src/db/prisma.js";

async function main() {
  // --- tenant ---
  const tenant = await prisma.tenant.upsert({
    where: { id: "t1" },
    update: {},
    create: {
      id: "t1",
      name: "Test Tenant",
    },
  });

  // --- role ---
  const role = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "ADMIN" } },
    update: {},
    create: {
      id: "r1",
      tenantId: tenant.id,
      name: "ADMIN",
      permissions: ["product:read", "product:write"],
    },
  });

  // --- user ---
  await prisma.user.upsert({
    where: { id: "u1" },
    update: {},
    create: {
      id: "u1",
      email: "user@test.local",
      tenantId: tenant.id,
      roleId: role.id,
    },
  });

  // --- products ---
  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      { id: "p1", tenantId: tenant.id, sku: "SKU-001", name: "Product One" },
      { id: "p2", tenantId: tenant.id, sku: "SKU-002", name: "Product Two" },
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
