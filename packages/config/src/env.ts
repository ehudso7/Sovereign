import { z } from 'zod';

/**
 * Shared environment variable schema.
 * Each app extends this with its own required variables.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export const redisEnvSchema = z.object({
  REDIS_URL: z.string().url(),
});

export const authEnvSchema = z.object({
  WORKOS_API_KEY: z.string().min(1),
  WORKOS_CLIENT_ID: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
});

export const temporalEnvSchema = z.object({
  TEMPORAL_ADDRESS: z.string().min(1).default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().min(1).default('sovereign'),
});

export const storageEnvSchema = z.object({
  R2_BUCKET: z.string().min(1),
  R2_REGION: z.string().min(1).default('auto'),
  R2_ENDPOINT: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

export const openaiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
});

export const billingEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

/**
 * Validate environment variables against a schema.
 * Throws with clear error messages on validation failure.
 */
export function validateEnv<T extends z.ZodTypeAny>(schema: T, env: unknown = process.env): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}
