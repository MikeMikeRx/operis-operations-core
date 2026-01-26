import { Queue } from "bullmq";
import { connection } from "../workers/redis.js";

export const maintenanceQueue = new Queue("maintenance", { connection });

export async function ensureMaintenanceJobs() {
  await maintenanceQueue.add(
    "cleanup-idempotency",
    {},
    { repeat: { every: 60 * 60 * 1000, immediately: true }, removeOnComplete: true, removeOnFail: 100 }
  );

  await maintenanceQueue.add(
    "purge-soft-deleted-products",
    {},
    { repeat: { every: 24 * 60 * 60 * 1000, immediately: true }, removeOnComplete: true }
  );

  await maintenanceQueue.add(
    "purge-audit-logs",
    {},
    { repeat: { every: 24 * 60 * 60 * 1000, immediately: true }, removeOnComplete: true }
  );
}
