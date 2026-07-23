/// <reference types="vitest/config" />

import { type UserConfig, defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import reactPlugin from "@vitejs/plugin-react";
import { spaCopyPlugin } from "./scripts/spaCopyPlugin";

type Config = Required<UserConfig>;
const resolveAlias: Config["resolve"] = {
    alias: {
        "@": fileURLToPath(new URL("src", import.meta.url)),
        "@server": fileURLToPath(new URL("server/src", import.meta.url)),
        "@test": fileURLToPath(new URL("tests", import.meta.url)),
    },
};

const testConfig: Config["test"] = {
    coverage: {
        enabled: true,
        include: ["src/**/*.{ts,tsx}"],
        provider: "v8",
        reportOnFailure: true,
        reporter: ["text", "json-summary", "html"],
    },
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    projects: [
        {
            extends: true,
            test: {
                environment: "jsdom",
                environmentOptions: {
                    jsdom: {
                        url: "http://localhost/",
                    },
                },
                exclude: ["**/__screenshots__/**"],
                include: ["**/tests/browser/**"],
                name: "browser",
                env: { VITEST_MODE: "browser" },
                setupFiles: "./tests/setup.ts",
            },
        },
        {
            extends: true,
            test: {
                environment: "node",
                exclude: ["**/tests/browser/**"],
                name: "node",
                env: {
                    VITEST_MODE: "node",
                },
                setupFiles: "./tests/setup.ts",
            },
        },
    ],
};
export default defineConfig(({ mode }) => ({
    base: mode === "heroku" ? "/" : "./",
    build: {
        outDir: "dist",
        sourcemap: true,
    },
    plugins: [reactPlugin(), spaCopyPlugin(["/"])],
    resolve: resolveAlias,
    server: {
        open: false,
        proxy: {
            "/api": {
                changeOrigin: true,
                target: `http://127.0.0.1:${process.env.API_PORT ?? process.env.PORT ?? "8787"}`,
            },
        },
    },
    test: testConfig,
}));
