import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["node_modules/**", "dist/**", "docs/**", "src/viewer/generated/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["error", 60],
      "max-params": ["error", 3],
      "max-nested-callbacks": ["error", 3],
      "no-console": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      yoda: ["error", "never"],
      "consistent-return": "error",
      "no-shadow": "error",
      "no-lonely-if": "error",
      "no-unneeded-ternary": "error",
      "one-var": ["error", "never"],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    files: ["src/core/**/*.ts", "src/ports/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["**/adapters/**", "**/cli*", "node:*", "bun", "bun:*"], message: "core and ports import nothing from adapters, the CLI, or the host (TypeScript standard, Rule 2)." }] }],
    },
  },
  {
    files: ["test/**/*.ts", "e2e/**/*.ts"],
    rules: { "max-lines-per-function": "off", "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    files: ["src/cli.ts", "scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
);
