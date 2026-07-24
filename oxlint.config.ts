import { defineConfig } from "oxlint";
import eslintConfig from "./scripts/linter/oxlint-eslint.ts";
import reactConfig from "./scripts/linter/oxlint-react.ts";

export default defineConfig({
    $schema: "./node_modules/oxlint/configuration_schema.json",
    plugins: ["typescript", "unicorn", "import", "vitest", "promise", "react"],
    env: {
        builtin: true,
    },
    ignorePatterns: [
        "**/node_modules/**",
        "**/dist/**",
        "**/dist-ts/**",
        "**/coverage/**",
        "**/.cache/**",
        "**/.vscode/**",
        "**/.git/**",
    ],
    overrides: [
        {
            files: ["**/*.d.ts"],
            rules: {
                "no-unused-vars": "off",
            },
        },
        {
            files: ["scripts/**/*.ts"],
            rules: {
                "no-console": "off",
            },
        },
        {
            files: ["tests/**/*.test.ts"],
            rules: {
                "typescript/no-unsafe-assignment": "off",
                "typescript/no-unsafe-member-access": "off",
                "typescript/no-unsafe-call": "off",
                "typescript/no-unsafe-return": "off",
                "vitest/no-conditional-expect": "off",
                "vitest/require-mock-type-parameters": "off",
                "eslint/eqeqeq": "off",
            },
        },
    ],
    options: {
        denyWarnings: true,
        reportUnusedDisableDirectives: "error",
        typeAware: true,
        typeCheck: true,
    },
    extends: [eslintConfig, reactConfig],
});
