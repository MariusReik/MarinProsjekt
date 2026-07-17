// Flat ESLint config for the Node/TypeScript ingest service (issue #16).
// typescript-eslint's recommended rules, no type-checked rules (fast, no
// program build needed in CI). Node globals for the runtime.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Allow deliberately-unused args/vars prefixed with _ (e.g. mock fetch
      // signatures that must match the DOM type but ignore their arguments).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Test doubles/fakes legitimately reach for `any`.
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    // Ambient declaration files declare names not "used" within the file.
    files: ["**/*.d.ts"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
);
