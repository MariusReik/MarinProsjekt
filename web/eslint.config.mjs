// Flat ESLint config for the React/TypeScript dashboard (issue #16).
// typescript-eslint recommended + the classic React Hooks rules, browser
// globals. No type-checked rules (fast CI). We use the classic hooks rules
// explicitly rather than the v6 "recommended" preset: the latter bundles the
// React Compiler rules (e.g. react-hooks/refs), which reject the deliberate
// "mirror latest props into a ref during render" pattern MapView relies on to
// feed values into the once-registered MapLibre event handlers.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
