/**
 * Redis client with in-memory fallback.
 * When REDIS_URL is not set, all rate-limit operations
 * use a simple in-memory store (suitable for dev/single-instance).
 */

let redisClient: import("ioredis").Redis | null = null;

// In-memory store fallback
const memStore = new Map<string, { value: string; expiresAt: number }>();

function cleanMemStore() {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.expiresAt < now) memStore.delete(key);
  }
}

async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;

  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn("[Redis] Connection failed, using in-memory fallback:", err);
    return null;
  }
}

// ─── Rate Limit Store ────────────────────────────────────────────────────────

/**
 * Increment a rate-limit counter.
 * Returns the new count. TTL is in seconds.
 */
export async function rlIncr(key: string, ttlSeconds: number): Promise<number> {
  const redis = await getRedis();
  if (redis) {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds);
    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) ?? 1;
  }

  // In-memory fallback
  cleanMemStore();
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.expiresAt < now) {
    memStore.set(key, { value: "1", expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }
  const newVal = parseInt(entry.value) + 1;
  entry.value = String(newVal);
  return newVal;
}

/**
 * Get a cached value. Returns null if not found or expired.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const redis = await getRedis();
  if (redis) return redis.get(key);

  cleanMemStore();
  const entry = memStore.get(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.value;
}

/**
 * Set a cached value with TTL in seconds.
 */
export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.setex(key, ttlSeconds, value);
    return;
  }
  memStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.del(key);
    return;
  }
  memStore.delete(key);
}

/**
 * Check if Redis is available.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const redis = await getRedis();
  return redis !== null;
}
