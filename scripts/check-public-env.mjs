#!/usr/bin/env node
// Fails if a secret-looking variable is exposed with NEXT_PUBLIC_, or if the
// value of any configured server secret appears in the client bundle.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ALLOWED_PUBLIC = new Set([
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
]);
const SECRET_NAMES = ["CLERK_SECRET_KEY", "CLERK_WEBHOOK_SIGNING_SECRET", "SUPABASE_SECRET_KEY", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "SENTRY_AUTH_TOKEN", "RESEND_API_KEY", "CRON_SECRET", "LINK_SIGNING_SECRET", "GEMINI_FREE_API_KEY", "GEMINI_PAID_API_KEY"];
const problems = [];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "coverage"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// 1. Every NEXT_PUBLIC_ name used in source or env examples must be allowlisted.
for (const file of [...walk(path.join(root, "src")), path.join(root, ".env.example"), path.join(root, "next.config.ts")]) {
  if (!/\.(ts|tsx|mjs|js|example)$/.test(file) || !fs.existsSync(file)) continue;
  for (const match of fs.readFileSync(file, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
    if (!ALLOWED_PUBLIC.has(match[0])) problems.push(`${path.relative(root, file)}: unexpected public variable ${match[0]}`);
  }
}

// 2. No configured secret value may appear in the client bundle.
const clientDir = path.join(root, ".next", "static");
if (fs.existsSync(clientDir)) {
  const secrets = SECRET_NAMES.map((name) => [name, process.env[name]]).filter(([, value]) => value && value.length >= 8);
  for (const file of walk(clientDir)) {
    if (!/\.(js|css|json|html)$/.test(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const [name, value] of secrets) if (content.includes(value)) problems.push(`${path.relative(root, file)} contains the value of ${name}`);
    for (const pattern of [/sk_live_[A-Za-z0-9]{10,}/, /sb_secret_[A-Za-z0-9_-]{10,}/]) {
      if (pattern.test(content)) problems.push(`${path.relative(root, file)} contains a secret-key-shaped string (${pattern})`);
    }
  }
} else {
  console.log("No .next/static directory; bundle scan skipped (run after `next build`).");
}

if (problems.length) {
  console.error("Public environment check FAILED:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("Public environment check passed.");
