import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerCors, resolveCorsConfig } from '../lib/cors.js';

describe('registerCors', () => {
  afterEach(() => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGINS;
    delete process.env.NODE_ENV;
  });

  it('allows configured production origins', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com, https://admin.example.com';

    const app = Fastify();
    registerCors(app, resolveCorsConfig(process.env));
    app.get('/ping', async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://app.example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(res.headers.vary).toBe('Origin');

    await app.close();
  });

  it('blocks unconfigured production origins', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';

    const app = Fastify();
    registerCors(app, resolveCorsConfig(process.env));
    app.get('/ping', async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    await app.close();
  });

  it('echoes the browser origin in non-production so credentialed requests can work', async () => {
    process.env.NODE_ENV = 'development';

    const app = Fastify();
    registerCors(app, resolveCorsConfig(process.env));
    app.get('/ping', async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/ping',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('POST');

    await app.close();
  });

  it('falls back to APP_BASE_URL in production when no CORS origins configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_BASE_URL = 'https://app.sovereignos.dev';

    const app = Fastify();
    registerCors(app, resolveCorsConfig(process.env));
    app.get('/ping', async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://app.sovereignos.dev' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.sovereignos.dev');
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    // Other origins should still be blocked
    const res2 = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://evil.example.com' },
    });
    expect(res2.headers['access-control-allow-origin']).toBeUndefined();

    delete process.env.APP_BASE_URL;
    await app.close();
  });

  it('keeps supporting the legacy CORS_ORIGINS name', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.example.com';

    const app = Fastify();
    registerCors(app, resolveCorsConfig(process.env));
    app.get('/ping', async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://app.example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');

    await app.close();
  });
});
