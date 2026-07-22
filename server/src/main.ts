import "dotenv/config";
import { serve } from "@hono/node-server";
import { createWebApp } from "./web";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
const server = serve(
    {
        fetch: createWebApp().fetch,
        hostname: "0.0.0.0",
        port,
    },
    (info) => {
        process.stdout.write(`API listening on http://0.0.0.0:${info.port}\n`);
    }
);

let shuttingDown = false;
function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(`Received ${signal}; shutting down\n`);
    const forceExit = setTimeout(() => {
        process.exitCode = 1;
        process.exit();
    }, 25_000);
    forceExit.unref();
    server.close((error) => {
        clearTimeout(forceExit);
        if (error) {
            process.exitCode = 1;
            process.stderr.write(
                `HTTP server shutdown failed: ${String(error)}\n`
            );
        }
    });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
