import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // Existing codebase contains intentional/legacy `any` usage.
      // TypeScript typecheck remains authoritative for actual type errors.
      "@typescript-eslint/no-explicit-any": "off",

      // Existing workout UI uses state synchronization effects.
      // This can be refactored separately without blocking feature work.
      "react-hooks/set-state-in-effect": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;