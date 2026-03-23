import type { FastifyInstance } from 'fastify';

export async function healthRoutes(server: FastifyInstance) {
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  server.get('/api/v1/health', async () => {
    return { status: 'ok', version: '0.0.1', timestamp: new Date().toISOString() };
  });
}
