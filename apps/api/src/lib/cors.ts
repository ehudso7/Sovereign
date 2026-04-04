import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const DEFAULT_ALLOWED_HEADERS = 'Authorization, Content-Type, X-Request-Id, X-CSRF-Token';
const DEFAULT_ALLOWED_METHODS = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
const DEFAULT_MAX_AGE_SECONDS = '86400';

export interface CorsConfig {
  allowAnyOrigin: boolean;
  allowedOrigins: Set<string>;
}

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

export function isAllowedBrowserUrl(
  url: string,
  config: CorsConfig = resolveCorsConfig(),
): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    if (config.allowAnyOrigin) {
      return true;
    }

    return config.allowedOrigins.has(normalizeOrigin(parsed.origin));
  } catch {
    return false;
  }
}

export function resolveDefaultAllowedOrigin(
  config: CorsConfig = resolveCorsConfig(),
): string | null {
  if (config.allowAnyOrigin) {
    return process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000';
  }

  const [origin] = config.allowedOrigins;
  return origin ?? null;
}

export function resolveCorsConfig(env: NodeJS.ProcessEnv = process.env): CorsConfig {
  const configuredOrigins = (env.CORS_ALLOWED_ORIGINS ?? env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return {
      allowAnyOrigin: false,
      allowedOrigins: new Set(configuredOrigins),
    };
  }

  return {
    allowAnyOrigin: env.NODE_ENV !== 'production',
    allowedOrigins: new Set<string>(),
  };
}

function setCorsHeaders(request: FastifyRequest, reply: FastifyReply, config: CorsConfig): boolean {
  const originHeader = request.headers.origin;
  const origin = typeof originHeader === 'string' ? normalizeOrigin(originHeader) : undefined;

  if (config.allowAnyOrigin) {
    if (origin) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header('Access-Control-Allow-Credentials', 'true');
    } else {
      reply.header('Access-Control-Allow-Origin', '*');
    }
    reply.header('Access-Control-Allow-Headers', DEFAULT_ALLOWED_HEADERS);
    reply.header('Access-Control-Allow-Methods', DEFAULT_ALLOWED_METHODS);
    reply.header('Access-Control-Max-Age', DEFAULT_MAX_AGE_SECONDS);
    return true;
  }

  if (!origin || !config.allowedOrigins.has(origin)) {
    return false;
  }

  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Headers', DEFAULT_ALLOWED_HEADERS);
  reply.header('Access-Control-Allow-Methods', DEFAULT_ALLOWED_METHODS);
  reply.header('Access-Control-Max-Age', DEFAULT_MAX_AGE_SECONDS);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Vary', 'Origin');
  return true;
}

export function registerCors(app: FastifyInstance, config: CorsConfig = resolveCorsConfig()): void {
  app.addHook('onRequest', async (request, reply) => {
    setCorsHeaders(request, reply, config);

    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }
  });
}
