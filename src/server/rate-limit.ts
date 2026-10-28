import "server-only";

type Bucket = { count: number; resetAt: number };

/**
 * Small fixed-window limiter. State is per server instance, so on serverless
 * hosting it is a deterrent, not a guarantee (documented in the threat model).
 * The database adds a global ceiling for the contact form.
 */
export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }) {
  const buckets = new Map<string, Bucket>();
  const maxKeys = options.maxKeys ?? 10_000;
  return {
    check(key: string, now = Date.now()): boolean {
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        if (buckets.size >= maxKeys) {
          for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
          if (buckets.size >= maxKeys) buckets.clear();
        }
        buckets.set(key, { count: 1, resetAt: now + options.windowMs });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= options.limit;
    },
  };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}
