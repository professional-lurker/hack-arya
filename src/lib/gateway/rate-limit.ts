/**
 * Rate limiting module.
 * Enforces per-key, per-user, and per-IP rate limits using Redis (or in-memory fallback).
 */

import { rlIncr } from "../redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  limit: number;
  current: number;
}

/**
 * Check and increment a rate limit bucket.
 * @param key - Redis key identifier
 * @param limit - Max requests in the window
 * @param windowSeconds - Window duration in seconds
 */
async function checkLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const current = await rlIncr(key, windowSeconds);
  const allowed = current <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - current),
    resetInSeconds: windowSeconds,
    limit,
    current,
  };
}

/**
 * Per sandbox key rate limit (e.g., 5 req/min)
 */
export async function checkKeyRateLimit(
  keyId: string,
  maxRatePer60s: number
): Promise<RateLimitResult> {
  const bucket = `rl:key:${keyId}:${Math.floor(Date.now() / 60000)}`;
  return checkLimit(bucket, maxRatePer60s, 60);
}

/**
 * Per user rate limit (e.g., 20 req/min)
 */
export async function checkUserRateLimit(userId: string): Promise<RateLimitResult> {
  const maxPerMin = parseInt(process.env.MAX_REQUESTS_PER_USER_PER_MINUTE ?? "20");
  const bucket = `rl:user:${userId}:${Math.floor(Date.now() / 60000)}`;
  return checkLimit(bucket, maxPerMin, 60);
}

/**
 * Per IP rate limit (e.g., 100 req/hour)
 */
export async function checkIpRateLimit(ipHash: string): Promise<RateLimitResult> {
  const maxPerHour = parseInt(process.env.MAX_REQUESTS_PER_IP_PER_HOUR ?? "100");
  const bucket = `rl:ip:${ipHash}:${Math.floor(Date.now() / 3600000)}`;
  return checkLimit(bucket, maxPerHour, 3600);
}
