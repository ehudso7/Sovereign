/**
 * Rate limiting middleware for Fastify
 * Provides distributed rate limiting using Redis backend
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import Redis from "ioredis";

// Different rate limit tiers
const rateLimiters = new Map<string, RateLimiterRedis>();
let redisClient: Redis | null = null;

// Initialize Redis client
export async function getRedisClient(): Promise<Redis> {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisClient = new Redis(redisUrl);
  }
  return redisClient;
}

// Initialize rate limiters with Redis backend for distributed rate limiting
export async function initRateLimiters() {
  const redis = await getRedisClient();

  // Standard API endpoints - 100 requests per minute
  rateLimiters.set("standard", new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:standard",
    points: 100,
    duration: 60,
    blockDuration: 60,
  }));

  // Auth endpoints - 10 requests per minute (prevent brute force)
  rateLimiters.set("auth", new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:auth",
    points: 10,
    duration: 60,
    blockDuration: 300, // Block for 5 minutes after limit exceeded
  }));

  // Heavy operations - 10 requests per minute
  rateLimiters.set("heavy", new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:heavy",
    points: 10,
    duration: 60,
    blockDuration: 60,
  }));

  // Health checks - 1000 requests per minute
  rateLimiters.set("health", new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "rl:health",
    points: 1000,
    duration: 60,
    blockDuration: 10,
  }));
}

// Fastify plugin for rate limiting
export async function rateLimitPlugin(fastify: FastifyInstance) {
  await initRateLimiters();

  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Determine rate limit tier based on route
    let tier = "standard";
    if (request.url.startsWith("/auth")) tier = "auth";
    else if (request.url.startsWith("/health")) tier = "health";
    else if (request.url.includes("/runs") || request.url.includes("/agents")) tier = "heavy";

    const limiter = rateLimiters.get(tier);
    if (!limiter) {
      // If rate limiter not initialized, allow request but log warning
      fastify.log.warn(`Rate limiter for tier ${tier} not initialized`);
      return;
    }

    // Use IP + user ID (if authenticated) as key
    const key = request.ip;

    try {
      await limiter.consume(key);

      // Add rate limit headers
      const rateLimiterRes = await limiter.get(key);
      if (rateLimiterRes) {
        reply.header("X-RateLimit-Limit", limiter.points.toString());
        reply.header("X-RateLimit-Remaining", rateLimiterRes.remainingPoints.toString());
        reply.header("X-RateLimit-Reset", new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
      }
    } catch (error) {
      const rateLimiterRes = error as RateLimiterRes;
      // Rate limit exceeded
      reply.header("Retry-After", Math.round(rateLimiterRes.msBeforeNext / 1000).toString());
      reply.header("X-RateLimit-Limit", limiter.points.toString());
      reply.header("X-RateLimit-Remaining", "0");
      reply.header("X-RateLimit-Reset", new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());

      return reply.status(429).send({
        error: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000),
      });
    }
  });
}