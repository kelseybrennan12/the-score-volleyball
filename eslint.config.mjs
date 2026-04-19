import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [".next/**", "node_modules/**", "data/**"],
  },
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
];
