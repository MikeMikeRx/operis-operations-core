import { Worker } from "bullmq";
import { connection } from "./workers/redis.js";
import { prisma } from "./db/prisma.js";
import { cleanupIdempotencyKeys } from "./workers/jobs/cleanupIdempotency.js";
import { purgeSoftDeletedProducts } from "./workers/jobs/purgeSoftDeletedProducts.js";
import { purgeAuditLogs } from "./workers/jobs/purgeAuditLogs.js";

const worker = new Worker(
  "maintenance",
  async (job) => {
    switch (job.name) {
      case "cleanup-idempotency":
        return cleanupIdempotencyKeys(prisma);
      case "purge-soft-deleted-products":
        return purgeSoftDeletedProducts(prisma);
      case "purge-audit-logs":
        return purgeAuditLogs(prisma);
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  { connection }
);

worker.on("completed", (job, result) => {
  console.log("job completed", { name: job.name, result });
});

worker.on("failed", (job, err) => {
  console.error("job failed", { jobId: job?.id, name: job?.name, err });
});

process.on("SIGINT", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
