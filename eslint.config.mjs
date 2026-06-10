import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
    ".next/**",
    ".next-dev/**",
    ".next-build/**",
    ".worktrees/**",
    "worktrees/**",
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts"
  ])
];

export default eslintConfig;
