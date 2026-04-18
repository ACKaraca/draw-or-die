import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
    {
        ignores: [
            "coverage/**",
            "node_modules/**",
            ".next/**",
            "public/pdf.worker.min.mjs",
            ".claude/**",
            "scripts/**",
        ],
    },
    {
        extends: [...next],
    },
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            security,
        },
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            // Type safety (AI-consistency hardening)
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/consistent-type-imports": [
                "warn",
                { prefer: "type-imports", fixStyle: "separate-type-imports" },
            ],
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/ban-ts-comment": [
                "warn",
                { "ts-expect-error": "allow-with-description", "ts-ignore": true, "ts-nocheck": true },
            ],

            // Code style consistency across AI models
            "eqeqeq": ["error", "smart"],
            "curly": ["warn", "multi-line"],
            "no-var": "error",
            "prefer-const": "warn",
            "object-shorthand": ["warn", "always"],
            "no-duplicate-imports": "warn",
            "no-useless-rename": "warn",
            "prefer-template": "warn",

            // Forbid debugging/leftover code in production
            "no-console": ["warn", { allow: ["warn", "error", "info"] }],
            "no-debugger": "error",
            "no-alert": "warn",

            // Security
            "security/detect-unsafe-regex": "warn",
            "security/detect-object-injection": "off",
            "security/detect-eval-with-expression": "error",
            "security/detect-non-literal-require": "warn",
            "security/detect-buffer-noassert": "error",
        },
    },
    {
        // Test files: relax some rules
        files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}", "jest.setup.js"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "no-console": "off",
        },
    },
    {
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-require-imports": "off",
        },
    },
]);
