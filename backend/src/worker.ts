import { Worker } from "bullmq";
import { connection } from "./workers/redis.js";
import { prisma } from "./db/prisma.js";
import { cleanupIdempotencyKeys } from "./workers/jobs/cleanupIdempotency.js";

const worker = new Worker(
  "maintenance",
  async (job) => {
    if (job.name === "cleanup-idempotency") {
      return cleanupIdempotencyKeys(prisma);
    }
    throw new Error(`Unknown job: ${job.name}`);
  },
  { connection }
);

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error("job failed", { jobId: job?.id, name: job?.name, err });
});

process.on("SIGINT", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
