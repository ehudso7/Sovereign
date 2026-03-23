// ---------------------------------------------------------------------------
// Dev-only routes — only available in local/development mode
// ---------------------------------------------------------------------------

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getServices } from "../services/index.js";

const bootstrapSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  orgName: z.string().min(1),
  orgSlug: z.string().min(1).regex(/^[a-z0-9-]+$/),
});

export async function devRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/v1/dev/bootstrap — create a user + org for local development
  server.post("/api/v1/dev/bootstrap", async (request, reply) => {
    const body = bootstrapSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "BAD_REQUEST", message: "Invalid request body", details: body.error.issues },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    const services = getServices();

    // Create user if not exists
    let userResult = await services.users.getByEmail(body.data.email);
    if (!userResult.ok) {
      userResult = await services.users.create({
        email: body.data.email,
        name: body.data.name,
      });
      if (!userResult.ok) {
        return reply.status(userResult.error.statusCode).send({
          error: { code: userResult.error.code, message: userResult.error.message },
          meta: { request_id: request.id, timestamp: new Date().toISOString() },
        });
      }
    }

    const user = userResult.value;

    // Create org (which also creates owner membership)
    const orgResult = await services.orgs.create(
      { name: body.data.orgName, slug: body.data.orgSlug },
      user.id,
    );

    if (!orgResult.ok) {
      return reply.status(orgResult.error.statusCode).send({
        error: { code: orgResult.error.code, message: orgResult.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    // Sign in to get a session token
    const authResult = await services.auth.signIn(user.email);
    if (!authResult.ok) {
      return reply.status(authResult.error.statusCode).send({
        error: { code: authResult.error.code, message: authResult.error.message },
        meta: { request_id: request.id, timestamp: new Date().toISOString() },
      });
    }

    return reply.status(201).send({
      data: {
        user,
        org: orgResult.value,
        auth: authResult.value,
      },
      meta: { request_id: request.id, timestamp: new Date().toISOString() },
    });
  });
}
