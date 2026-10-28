import { z } from "zod";

/**
 * Environment configuration.
 *
 * Rules:
 * - Anything prefixed NEXT_PUBLIC_ is compiled into browser bundles and must
 *   be safe to publish. `scripts/check-public-env.mjs` fails the build if a
 *   secret-looking name uses that prefix or a secret value appears in the
 *   client bundle.
 * - Server values are validated lazily on first use, so a missing optional
 *   integration (for example Razorpay before credentials exist) fails only the
 *   feature that needs it, with a clear error, instead of the whole app.
 */

export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const publicSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(APP_ENVS).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
});

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

/** Public values must be referenced literally so Next.js can inline them. */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_ENV: emptyToUndefined(process.env.NEXT_PUBLIC_APP_ENV),
  NEXT_PUBLIC_APP_URL: emptyToUndefined(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_SENTRY_DSN: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN),
  NEXT_PUBLIC_POSTHOG_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_POSTHOG_KEY),
  NEXT_PUBLIC_POSTHOG_HOST: emptyToUndefined(process.env.NEXT_PUBLIC_POSTHOG_HOST),
});

const supabaseSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const supabaseSecretSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
});

const razorpaySchema = z.object({
  RAZORPAY_KEY_ID: z.string().regex(/^rzp_(test|live)_[A-Za-z0-9]+$/, "RAZORPAY_KEY_ID must look like rzp_test_… or rzp_live_…"),
  RAZORPAY_KEY_SECRET: z.string().min(10),
});

const razorpayWebhookSchema = z.object({
  RAZORPAY_WEBHOOK_SECRET: z.string().min(10),
});

export class MissingConfigurationError extends Error {
  constructor(area: string, issues: string) {
    super(`Missing or invalid configuration for ${area}: ${issues}`);
    this.name = "MissingConfigurationError";
  }
}

function load<T extends z.ZodType>(area: string, schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Only variable names are reported, never values.
    const names = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new MissingConfigurationError(area, names);
  }
  return result.data;
}

export function supabaseEnv() {
  return load("Supabase", supabaseSchema);
}

/** Server-only: the privileged key. Imported only by src/server/privileged. */
export function supabaseSecretEnv() {
  return load("Supabase (secret)", supabaseSecretSchema);
}

export function razorpayEnv() {
  const env = load("Razorpay", razorpaySchema);
  const appEnv = publicEnv.NEXT_PUBLIC_APP_ENV;
  // Guard against live keys outside production and test keys in production.
  if (appEnv !== "production" && env.RAZORPAY_KEY_ID.startsWith("rzp_live_")) {
    throw new MissingConfigurationError("Razorpay", "live key used outside production");
  }
  if (appEnv === "production" && env.RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
    throw new MissingConfigurationError("Razorpay", "test key used in production");
  }
  return env;
}

export function razorpayWebhookEnv() {
  return load("Razorpay webhook", razorpayWebhookSchema);
}

export function isConfigured(area: "supabase" | "razorpay" | "razorpayWebhook" | "clerk"): boolean {
  try {
    switch (area) {
      case "supabase":
        supabaseEnv();
        return true;
      case "razorpay":
        razorpayEnv();
        return true;
      case "razorpayWebhook":
        razorpayWebhookEnv();
        return true;
      case "clerk":
        return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
    }
  } catch {
    return false;
  }
}
