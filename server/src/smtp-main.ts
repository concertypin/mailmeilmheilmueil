import "dotenv/config";
import { startTestSmtpServer } from "./smtp-receiver";

const server = startTestSmtpServer();
let shuttingDown = false;

function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(`Received ${signal}; shutting down SMTP server\n`);
    server.close(() => {
        process.stdout.write("SMTP server closed\n");
    });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
