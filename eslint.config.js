import react from "eslint-plugin-react";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.git/**"]
  },
  {
    files: ["**/*.{js,mjs,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "error"
    }
  },
  {
    // JSX files: register eslint-plugin-react's jsx-uses-vars rule so
    // imports/variables referenced only as <Component /> in JSX are
    // correctly recognized as used (the base no-unused-vars rule's plain
    // AST scan doesn't see JSX element names as identifier references).
    files: ["client/**/*.jsx"],
    plugins: { react },
    rules: {
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off"
    }
  },
  {
    files: ["shared/**/*.{js,mjs}", "server/**/*.{js,mjs}", "*.{js,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        URL: "readonly",
        crypto: "readonly"
      }
    }
  },
  {
    files: ["client/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        crypto: "readonly",
        KeyboardEvent: "readonly"
      }
    }
  }
];
