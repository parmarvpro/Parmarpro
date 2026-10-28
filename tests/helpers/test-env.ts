import fs from "node:fs";
import path from "node:path";

/**
 * Connection details for the disposable local stack started by
 * `pnpm db:local:start` (scripts/local-db/start.sh). Tests fail loudly
 * rather than silently skipping when the stack is missing.
 */
export function loadTestEnv() {
  const file = path.resolve(__dirname, "../../.env.test.local");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && match[1] && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
    }
  }
  const { TEST_DATABASE_URL, TEST_POSTGREST_URL, TEST_JWT_SECRET } = process.env;
  if (!TEST_DATABASE_URL || !TEST_POSTGREST_URL || !TEST_JWT_SECRET) {
    throw new Error("Local test stack not running. Start it with `pnpm db:local:start`.");
  }
  return { databaseUrl: TEST_DATABASE_URL, postgrestUrl: TEST_POSTGREST_URL, jwtSecret: TEST_JWT_SECRET };
}
