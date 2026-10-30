import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const PRIVILEGED_CLIENT = {
  path: { name: "@/server/privileged/client", message: "The privileged (service-role) client may only be used inside src/server/privileged/." },
  pattern: {
    group: ["**/privileged/client", "**/privileged/client.ts"],
    message: "The privileged (service-role) client may only be used inside src/server/privileged/.",
  },
};

/**
 * Patterns for one AI module: the alias, and the relative forms a file in src/server/ai
 * (./name) or in src/server/ai/features (../name) uses. ESLint matches the import
 * specifier as written, so each relative form is listed.
 */
function aiModulePatterns(name) {
  return [`**/ai/${name}`, `**/ai/${name}.ts`, `./${name}`, `./${name}.ts`, `../${name}`, `../${name}.ts`];
}

/** The AI modules. Each may be imported only by the files that `importFence` allows. */
const AI_MODULES = {
  transport: {
    path: "@/server/ai/transport",
    patterns: aiModulePatterns("transport"),
    message: "Only the AI lanes may use the transport.",
  },
  freeLane: {
    path: "@/server/ai/free-lane",
    patterns: aiModulePatterns("free-lane"),
    message: "The free AI lane may only be used by vetted files that send no personal data.",
  },
  paidLane: {
    path: "@/server/ai/paid-lane",
    patterns: aiModulePatterns("paid-lane"),
    message: "The paid AI lane may only be used by vetted feature files.",
  },
};

/**
 * The no-restricted-imports options for one block. In flat config a later block's
 * options replace earlier ones for the files it matches, so every block lists the
 * full set: the privileged client, each AI module except those in `allow`, and any
 * extra patterns.
 */
function importFence({ allow = [], allowPrivilegedClient = false, extraPatterns = [] } = {}) {
  const paths = allowPrivilegedClient ? [] : [PRIVILEGED_CLIENT.path];
  const patterns = allowPrivilegedClient ? [] : [PRIVILEGED_CLIENT.pattern];
  for (const [key, entry] of Object.entries(AI_MODULES)) {
    if (allow.includes(key)) continue;
    paths.push({ name: entry.path, message: entry.message });
    patterns.push({ group: entry.patterns, message: entry.message });
  }
  return ["error", { paths, patterns: [...patterns, ...extraPatterns] }];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": importFence(),
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env'] > Identifier[name=/SECRET|SERVICE_ROLE/]",
          message: "Read secrets through src/lib/env.ts.",
        },
      ],
    },
  },
  {
    // The only place allowed to import the privileged client. The AI fence still applies here.
    files: ["src/server/privileged/**"],
    rules: { "no-restricted-imports": importFence({ allowPrivilegedClient: true }) },
  },
  {
    // The two lanes wrap the transport, so only they may import it.
    files: ["src/server/ai/free-lane.ts", "src/server/ai/paid-lane.ts"],
    rules: { "no-restricted-imports": importFence({ allow: ["transport"] }) },
  },
  {
    // Vetted feature files. Their allowlists come with the features (later phases).
    files: ["src/server/ai/features/ops-note.ts"],
    rules: { "no-restricted-imports": importFence({ allow: ["freeLane"] }) },
  },
  {
    files: ["src/server/ai/features/enquiry-sort.ts", "src/server/ai/features/reply-draft.ts"],
    rules: { "no-restricted-imports": importFence({ allow: ["paidLane"] }) },
  },
  {
    // Tests exercise every AI module directly.
    files: ["tests/**"],
    rules: { "no-restricted-imports": importFence({ allow: ["transport", "freeLane", "paidLane"] }) },
  },
  {
    // Client components and shared lib code must never import server modules.
    files: ["src/components/**", "src/lib/**"],
    rules: {
      "no-restricted-imports": importFence({
        extraPatterns: [
          {
            group: ["@/server/privileged/*", "@/server/db/*", "@/server/auth/context", "@/server/dal/*"],
            message: "Server-only modules cannot be imported from components or shared lib code.",
          },
        ],
      }),
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
