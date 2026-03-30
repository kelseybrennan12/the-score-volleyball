import tsParser from "@typescript-eslint/parser";

const envBoundaryMessage = "Use src/backend/runtime/adapters/infra/env.ts for backend environment access";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "padding-line-between-statements": [
        "error",
        {
          blankLine: "never",
          prev: "import",
          next: "import",
        },
      ],
    },
  },
  {
    files: ["src/backend/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: envBoundaryMessage,
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "process",
              message: envBoundaryMessage,
            },
            {
              name: "node:process",
              message: envBoundaryMessage,
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/backend/runtime/adapters/infra/env.ts"],
    rules: {
      "no-restricted-properties": "off",
      "no-restricted-imports": "off",
    },
  },
];
