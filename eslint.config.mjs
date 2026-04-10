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
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/consistent-type-imports": "off",
            "@typescript-eslint/no-require-imports": "off",
            "security/detect-unsafe-regex": "warn",
            "security/detect-object-injection": "off",
        },
    },
    {
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-require-imports": "off",
        },
    },
]);
