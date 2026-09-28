import type { FastifyInstance } from "fastify";
import { registerHealthRoute } from "./health.js";

export async function registerHttpRoutes(fastify: FastifyInstance): Promise<void> {
  await registerHealthRoute(fastify);
}
