/// <reference types="vitest/config" />

import { type UserConfig, defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import preact from "@preact/preset-vite";
import reactPlugin from "@vitejs/plugin-react";
import { spaCopyPlugin } from "./scripts/spaCopyPlugin";

// Toggle Preact/React at build time.
// true  → @preact/preset-vite aliases react, react-dom, react/jsx-runtime to preact/compat
// false → @vitejs/plugin-react uses the installed react, react-dom packages
const usePreact = true;

type Config = Required<UserConfig>;
const resolveAlias: Config["resolve"] = {
    alias: {
        "@": fileURLToPath(new URL("src", import.meta.url)),
    },
};

const browserInclude = ["**/tests/browser/**/*.test.{ts,tsx}"];
const browserTestConfig = {
    enabled: true,
    headless: true,
    instances: [
        {
            browser: "chromium",
            expect: {
                poll: {
                    timeout: 5000,
                },
            },
            include: browserInclude,
        },
    ],
    provider: playwright(),
} satisfies Config["test"]["browser"];

const testConfig: Config["test"] = {
    coverage: {
        enabled: true,
        include: ["src/**/*.{ts,tsx}"],
        provider: "v8",
        reportOnFailure: true,
        reporter: ["text", "json-summary", "html"],
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    projects: [
        {
            extends: true,
            test: {
                browser: browserTestConfig,
                name: "browser",
            },
        },
        {
            extends: true,
            test: {
                browser: {
                    enabled: false,
                },
                exclude: browserInclude,
                name: "node",
            },
        },
    ],
    setupFiles: "./tests/setup.ts",
};

const frameworkPlugins = usePreact
    ? preact({ jsxImportSource: "react", reactAliasesEnabled: true })
    : reactPlugin();

export default defineConfig(({ mode }) => ({
    base: mode === "heroku" ? "/" : "./",
    build: {
        outDir: "dist",
        sourcemap: true,
    },
    clearScreen: false,
    plugins: [frameworkPlugins, spaCopyPlugin(["/"])],
    resolve: resolveAlias,
    server: {
        open: "index.html",
    },
    test: testConfig,
}));
