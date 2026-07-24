import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import architecture from "./eslint-plugins/architecture.js";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      architecture,
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      "max-classes-per-file": ["error", 1],
      "max-lines": [
        "error",
        {
          max: 500,
          skipBlankLines: false,
          skipComments: false,
        },
      ],
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^React$",
        },
      ],
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react/jsx-uses-vars": "error",
    },
  },
  {
    files: ["**/*.{test,spec}.{js,jsx,mjs,cjs}"],
    rules: {
      "architecture/one-test-per-file": "error",
    },
  },
];
