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
 *   integration (for example Resend before credentials exist) fails only the
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

const emailSchema = z.object({
  RESEND_API_KEY: z.string().regex(/^re_[A-Za-z0-9_]{8,}$/),
  // "Name <address@domain>" or "address@domain".
  EMAIL_FROM: z
    .string()
    .min(5)
    .regex(/<[^<>@\s]+@[^<>@\s]+>$|^[^<>@\s]+@[^<>@\s]+$/),
});

const founderAlertSchema = z.object({
  FOUNDER_ALERT_EMAIL: z.email(),
});

const jobsSchema = z.object({
  CRON_SECRET: z.string().min(32),
});

const linkSigningSchema = z.object({
  LINK_SIGNING_SECRET: z.string().min(32),
});

const geminiFreeSchema = z.object({
  GEMINI_FREE_API_KEY: z.string().min(30),
});

const geminiPaidSchema = z.object({
  GEMINI_PAID_API_KEY: z.string().min(30),
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

/** Server-only: transactional email (Resend). */
export function emailEnv() {
  return load("Email", emailSchema);
}

/** Server-only: where founder alerts and the daily digest are sent. */
export function founderAlertEnv() {
  return load("Founder alerts", founderAlertSchema);
}

/** Server-only: bearer secret that authenticates the scheduled job endpoints. */
export function jobsEnv() {
  return load("Scheduled jobs", jobsSchema);
}

/** Server-only: HMAC key for signed action and unsubscribe links. */
export function linkSigningEnv() {
  return load("Signed links", linkSigningSchema);
}

/**
 * Server-only: the free-tier Gemini key. It belongs to a Google Cloud project WITHOUT
 * billing and may only receive our own non-personal data (see src/server/ai/free-lane.ts).
 */
export function geminiFreeEnv() {
  return load("Gemini (free)", geminiFreeSchema);
}

/** Server-only: the paid Gemini key. It belongs to a separate Google Cloud project WITH billing. */
export function geminiPaidEnv() {
  return load("Gemini (paid)", geminiPaidSchema);
}

type ConfiguredArea = "supabase" | "clerk";

/**
 * True when the configuration is present and valid. Accepts a named area
 * (existing callers) or a loader such as emailEnv. For a loader, only a
 * MissingConfigurationError yields false; any other error is a bug and is
 * rethrown.
 */
export function isConfigured(area: ConfiguredArea): boolean;
export function isConfigured(loader: () => unknown): boolean;
export function isConfigured(target: ConfiguredArea | (() => unknown)): boolean {
  if (typeof target === "function") {
    try {
      target();
      return true;
    } catch (error) {
      if (error instanceof MissingConfigurationError) return false;
      throw error;
    }
  }
  return isAreaConfigured(target);
}

function isAreaConfigured(area: ConfiguredArea): boolean {
  try {
    switch (area) {
      case "supabase":
        supabaseEnv();
        return true;
      case "clerk":
        return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
    }
  } catch {
    return false;
  }
}
