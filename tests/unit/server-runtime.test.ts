import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    analysisConfigFromEnv,
    type AnalysisEnvironment,
} from "../../server/src/analysis";
import { createWebApp } from "../../server/src/web";
import { firebaseCredentialFromEnv } from "../../server/src/firebase";

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) => rm(directory, { force: true, recursive: true }))
    );
});

async function fixtureRoot(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "mail-web-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, "index.html"), "<main>fixture SPA</main>");
    await writeFile(join(directory, "app.js"), "console.log('fixture');");
    return directory;
}

describe("Heroku web app", () => {
    it("serves the SPA shell and existing assets", async () => {
        const app = createWebApp({}, await fixtureRoot());

        const page = await app.request("/mails/unknown");
        expect(page.status).toBe(200);
        expect(await page.text()).toBe("<main>fixture SPA</main>");

        const asset = await app.request("/app.js");
        expect(asset.status).toBe(200);
        expect(await asset.text()).toBe("console.log('fixture');");
    });

    it("keeps API routing ahead of the SPA fallback", async () => {
        const app = createWebApp({}, await fixtureRoot());

        const health = await app.request("/healthz");
        expect(health.status).toBe(200);
        expect(await health.json()).toEqual({ status: "ok" });

        const missingApi = await app.request("/api/does-not-exist", {
            method: "POST",
        });
        expect(missingApi.status).toBe(404);
        expect(await missingApi.json()).toEqual({ error: "Not found" });
    });
});

describe("Firebase service-account environment parsing", () => {
    it("uses ADC when the environment value is absent", () => {
        expect(firebaseCredentialFromEnv(undefined)).toBeUndefined();
    });

    it("rejects invalid JSON without exposing the value", () => {
        expect(() => firebaseCredentialFromEnv("not-json")).toThrow(
            "FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON"
        );
    });
});

describe("AI analysis provider configuration", () => {
    it("uses explicit OpenAI-compatible settings", () => {
        const environment = {
            AI_API_KEY: "ai-key",
            AI_BASE_URL: "https://gateway.example/v1",
            AI_MODEL: "gateway-model",
            AI_PROVIDER: "openai",
        } satisfies AnalysisEnvironment;

        expect(analysisConfigFromEnv(environment)).toEqual({
            apiKey: "ai-key",
            baseUrl: "https://gateway.example/v1",
            model: "gateway-model",
            provider: "openai",
        });
    });

    it("selects OpenAI automatically when an API key is present", () => {
        const environment = {
            OPENAI_API_KEY: "openai-key",
        } satisfies AnalysisEnvironment;

        expect(analysisConfigFromEnv(environment)).toMatchObject({
            apiKey: "openai-key",
            model: "gpt-5.4-mini",
            provider: "openai",
        });
    });

    it("keeps Codex as the default without an API key", () => {
        expect(analysisConfigFromEnv({})).toEqual({
            apiKey: undefined,
            baseUrl: undefined,
            model: "gpt-5.4-mini",
            provider: "codex",
        });
    });

    it("rejects an unknown provider", () => {
        expect(() => analysisConfigFromEnv({ AI_PROVIDER: "unknown" })).toThrow(
            "AI_PROVIDER must be either codex or openai"
        );
    });
});
