import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRoutes, type RouteDependencies } from "./routes";

export function createWebApp(
    dependencies: RouteDependencies = {},
    staticRoot = "dist"
): Hono {
    const app = createRoutes(dependencies);

    if (existsSync(staticRoot)) {
        app.use("*", serveStatic({ root: staticRoot }));
        app.all("/api/*", (context) =>
            context.json({ error: "Not found" }, 404)
        );
        app.get("*", serveStatic({ root: staticRoot, path: "index.html" }));
    }

    return app;
}
