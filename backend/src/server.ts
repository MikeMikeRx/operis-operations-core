import { buildApp } from "./app.js";
import { ensureMaintenanceJobs } from "./queues/maintenance.js";

const app = buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });

  // Start background/maintenance jobs AFTER server is up
  await ensureMaintenanceJobs();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
