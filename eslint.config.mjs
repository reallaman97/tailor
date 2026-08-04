import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Underscore-prefixed params are intentionally unused (e.g. useActionState's
      // prevState/formData when an action ignores them) — a common convention.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The browser extension is a standalone MV3 sub-project with its own
    // runtime (chrome.* / service-worker globals) — linted separately, not
    // under the Next app's config.
    "extension/**",
  ]),
]);

export default eslintConfig;
