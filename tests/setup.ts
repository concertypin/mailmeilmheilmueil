// Global test setup - runs before all test files.
// Keep this file light since it runs for all test environments.
if (import.meta.env.VITEST_MODE === "browser")
    await import("@testing-library/jest-dom/vitest");
