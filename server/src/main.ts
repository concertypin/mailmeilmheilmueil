import "dotenv/config";
import { serve } from "@hono/node-server";
import { createRoutes } from "./routes";
import { startTestSmtpServer } from "./smtp-receiver";

const port = Number(process.env.API_PORT ?? 8787);
startTestSmtpServer();
serve({ fetch: createRoutes().fetch, hostname: "127.0.0.1", port }, (info) => {
    process.stdout.write(`API listening on http://127.0.0.1:${info.port}\n`);
});
