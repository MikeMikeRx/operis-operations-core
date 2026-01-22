import { Queue } from "bullmq";
import { connection } from "../workers/redis.js";

export const maintenanceQueue = new Queue("maintenance", { connection });

export async function ensureMaintenanceJobs() {
  // runs every hour
  await maintenanceQueue.add(
    "cleanup-idempotency",
    {},
    { repeat: { every: 60 * 60 * 1000 }, removeOnComplete: true, removeOnFail: 100 }
  );
}
