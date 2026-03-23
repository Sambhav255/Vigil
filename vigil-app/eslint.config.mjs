import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Convex backend functions — validated by Convex CLI
    "convex/auth.ts",
    "convex/auth.config.ts",
    "convex/http.ts",
    "convex/schema.ts",
    "convex/profiles.ts",
    "convex/alertLog.ts",
    "convex/savedThreats.ts",
  ]),
]);

export default eslintConfig;
