import type { FastifyInstance } from "fastify";

export interface HealthResponse {
  status: "ok";
  service: "omniplay-server";
}

export async function registerHealthRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get("/health", async (_req, reply) => {
    return reply.status(200).send({
      status: "ok",
      service: "omniplay-server",
    });
  });
}
