import { describe, expect, it } from "vitest";

describe("example browser test", () => {
    it.concurrent("should run in browser environment", () => {
        // Localstorage is only available in browser environment,
        // Not in node.
        // If this test runs successfully, the browser environment works.
        expect(localStorage).not.toBeNull();
    });
});
