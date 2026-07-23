import { describe, expect, it } from "vitest";

describe("example jsdom test", () => {
    it.concurrent("should run in jsdom environment", () => {
        // LocalStorage is available in jsdom environment,
        // Not in node.
        // If this test runs successfully, the jsdom environment works.
        expect(localStorage).not.toBeNull();
    });
});
