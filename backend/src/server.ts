import { buildApp } from "./app.js";
import { ensureMaintenanceJobs } from "./queues/maintenance.js";

const app = buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  await app.listen({ port, host });
  await ensureMaintenanceJobs();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
