// eslint.config.js for ESLint v9+
const globals = {
  window: true,
  document: true,
  navigator: true,
  fetch: true,
  FormData: true,
  Request: true,
  Response: true,
  Headers: true,
  console: true,
  crypto: true,
  addEventListener: true,
};

module.exports = [
  {
    files: ["**/*.{js,jsx}"],
    ignores: ["node_modules/**", "dist/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals,
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^unused" }],
      "no-undef": "warn",
    },
  },
];
