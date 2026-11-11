import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Domain records are deliberately flat, V6-shaped objects (see src/lib/domain/types.ts), so `any` is accepted here.
  { rules: { '@typescript-eslint/no-explicit-any': 'off' } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "src/generated/**",
    "out/**",
    "build/**",
    "Leads_Global_ERP_Final/**",
    "Reusable_ERP_Master_Template/**",
    "ERP_Analysis_And_Documentation/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
