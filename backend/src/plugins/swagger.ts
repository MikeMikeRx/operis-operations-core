import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export default fp(async function (app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Operis Operations Core API",
        description: "Backend-first Operations Core API",
        version: "v1",
      },
      // servers: [],
    },
  });

  await app.register(swaggerUI, {
    routePrefix: "/docs",
  });
});
