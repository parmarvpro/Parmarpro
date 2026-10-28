import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/privileged/client",
              message: "The privileged (service-role) client may only be used inside src/server/privileged/.",
            },
          ],
          patterns: [
            {
              group: ["**/privileged/client", "**/privileged/client.ts"],
              message: "The privileged (service-role) client may only be used inside src/server/privileged/.",
            },
          ],
        },
      ],
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
    // The only place allowed to import the privileged client.
    files: ["src/server/privileged/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Client components and shared lib code must never import server modules.
    files: ["src/components/**", "src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/privileged/*", "@/server/db/*", "@/server/auth/context", "@/server/dal/*"],
              message: "Server-only modules cannot be imported from components or shared lib code.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
