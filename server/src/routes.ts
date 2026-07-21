import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
    ImapCredentialError,
    ImapUnavailableError,
    type ImapCredentials,
    type ImapSyncResult,
    syncInbox,
} from "./imap";
import { imapSessions, type ImapSessionStore } from "./imap-session";
import { firestoreRepository, type MailRepository } from "./repository";

export type RouteDependencies = {
    repository?: MailRepository;
    imapSessions?: ImapSessionStore;
    syncInbox?: (credentials: ImapCredentials) => Promise<ImapSyncResult>;
};

const loginBody = z.object({ portalId: z.string(), password: z.string() });
const imapSessionCookie = {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 1800,
    secure: process.env.IMAP_COOKIE_SECURE !== "false",
} satisfies Parameters<typeof setCookie>[3];

function invalidImapSession(
    context: Parameters<typeof deleteCookie>[0]
): Response {
    deleteCookie(context, "imapSession", imapSessionCookie);
    return context.json({ error: "IMAP session is invalid or expired" }, 401);
}

export function createRoutes(dependencies: RouteDependencies = {}): Hono {
    const repository = dependencies.repository ?? firestoreRepository;
    const sessions = dependencies.imapSessions ?? imapSessions;
    const synchronize =
        dependencies.syncInbox ??
        ((credentials) => syncInbox(credentials, repository));
    const app = new Hono();

    app.get("/healthz", (context) => context.json({ status: "ok" }));

    app.post("/api/imap/login", async (context) => {
        let body: unknown;
        try {
            body = await context.req.json();
        } catch {
            return context.json({ error: "Invalid IMAP login request" }, 400);
        }
        const parsed = loginBody.safeParse(body);
        if (!parsed.success) {
            return context.json({ error: "Invalid IMAP login request" }, 400);
        }
        const portalId = parsed.data.portalId.trim();
        if (!portalId || portalId.includes("@") || !parsed.data.password) {
            return context.json({ error: "Invalid IMAP login request" }, 400);
        }
        try {
            const session = await sessions.create(
                portalId,
                parsed.data.password
            );
            setCookie(context, "imapSession", session.token, imapSessionCookie);
            return context.json({ account: session.account });
        } catch (error: unknown) {
            if (error instanceof ImapCredentialError) {
                return context.json(
                    { error: "IMAP authentication failed" },
                    401
                );
            }
            if (error instanceof ImapUnavailableError) {
                return context.json(
                    { error: "IMAP server is unavailable" },
                    502
                );
            }
            return context.json({ error: "IMAP server is unavailable" }, 502);
        }
    });

    app.post("/api/imap/sync", async (context) => {
        const token = getCookie(context, "imapSession");
        if (!token) {
            return invalidImapSession(context);
        }
        const credentials = sessions.get(token);
        if (!credentials) {
            return invalidImapSession(context);
        }
        setCookie(context, "imapSession", token, imapSessionCookie);
        try {
            return context.json(await synchronize(credentials));
        } catch (error: unknown) {
            if (error instanceof ImapCredentialError) {
                sessions.delete(token);
                return invalidImapSession(context);
            }
            if (error instanceof ImapUnavailableError) {
                return context.json(
                    { error: "IMAP server is unavailable" },
                    502
                );
            }
            return context.json({ error: "IMAP server is unavailable" }, 502);
        }
    });

    app.post("/api/mails/:id/review", async (context) => {
        const id = context.req.param("id");
        const item = await repository.get(id);
        if (!item) {
            return context.json({ error: "Mail not found" }, 404);
        }
        if (item.status !== "ready") {
            return context.json({ error: "Mail is not ready for review" }, 409);
        }
        const reviewedAt = Timestamp.now();
        await repository.update(id, { status: "reviewed", reviewedAt });
        return context.json({
            id,
            status: "reviewed",
            reviewedAt: reviewedAt.toDate().toISOString(),
        });
    });

    return app;
}
