import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/**
 * Vite plugin: after build, copy index.html to route directories for static hosting.
 * - dist/404.html for GitHub Pages SPA fallback
 * - dist/<route>/index.html for each route, with __SPA_ROUTE__ injected for file:// support
 */
export function spaCopyPlugin(routes: string[]): Plugin {
    const distDir = fileURLToPath(new URL("../dist", import.meta.url));
    return {
        name: "spa-copy",
        apply: "build",
        closeBundle: {
            order: "post",
            async handler() {
                const indexPath = resolve(distDir, "index.html");
                const indexContent = await readFile(indexPath, "utf-8");

                // 404.html for GitHub Pages
                await writeFile(
                    resolve(distDir, "404.html"),
                    indexContent,
                    "utf-8"
                );

                // Route directories with __SPA_ROUTE__ injection
                // Skip "/" — it's the main index.html, no copy needed
                for (const route of routes) {
                    if (route === "/") continue;
                    const routeDir = resolve(distDir, route.replace(/^\//, ""));
                    await mkdir(routeDir, { recursive: true });
                    const routeContent = indexContent.replace(
                        "</head>",
                        `  <script>window.__SPA_ROUTE__ = ${JSON.stringify(route)};</script>\n</head>`
                    );
                    await writeFile(
                        resolve(routeDir, "index.html"),
                        routeContent,
                        "utf-8"
                    );
                }
            },
        },
    };
}
