import { Hono } from "hono";
import { Timestamp } from "firebase-admin/firestore";
import {
    ComposeRequestSchema,
    FlagMailRequestSchema,
    ReviewMailRequestSchema,
    toMailApiItem,
} from "../../src/lib/mail-schema";
import { firestoreRepository, type MailRepository } from "./repository";
import { parseImapBasicAuthorization } from "./basic-auth";
import {
    syncInbox,
    ImapCredentialError,
    ImapUnavailableError,
    type ImapCredentials,
    type ImapSyncResult,
} from "./imap";

export type SyncFn = (
    credentials: ImapCredentials,
    repository: MailRepository
) => Promise<ImapSyncResult>;

export type RouteDependencies = {
    repository?: MailRepository;
    sync?: SyncFn;
};

export function createRoutes(dependencies: RouteDependencies = {}) {
    const repository = dependencies.repository ?? firestoreRepository;
    return new Hono()
        .get("/healthz", (context) => context.json({ status: "ok" }))
        .post("/api/login", (context) => {
            const credentials = parseImapBasicAuthorization(
                context.req.header("authorization")
            );
            if (!credentials) {
                return context.json(
                    { error: "IMAP credentials are required" },
                    401,
                    { "WWW-Authenticate": 'Basic realm="IMAP"' }
                );
            }
            return context.body(null, 204);
        })
        .post("/api/sync", async (context) => {
            const credentials = parseImapBasicAuthorization(
                context.req.header("authorization")
            );
            if (!credentials) {
                return context.json(
                    { error: "IMAP credentials are required" },
                    401,
                    { "WWW-Authenticate": 'Basic realm="IMAP"' }
                );
            }
            try {
                const sync = dependencies.sync ?? syncInbox;
                const result = await sync(credentials, repository);
                return context.json(result);
            } catch (error: unknown) {
                if (error instanceof ImapCredentialError) {
                    return context.json(
                        { error: "IMAP credentials are invalid" },
                        401,
                        { "WWW-Authenticate": 'Basic realm="IMAP"' }
                    );
                }
                if (error instanceof ImapUnavailableError) {
                    return context.json(
                        { error: "IMAP server is unavailable" },
                        502
                    );
                }
                return context.json(
                    { error: "IMAP synchronization failed" },
                    500
                );
            }
        })
        .get("/api/mails", async (context) => {
            const items = await repository.list();
            return context.json(items.map(toMailApiItem));
        })
        .get("/api/mails/:id", async (context) => {
            const id = context.req.param("id");
            const item = await repository.get(id);
            if (!item) {
                return context.json({ error: "Mail not found" }, 404);
            }
            return context.json(toMailApiItem(item));
        })
        .post("/api/mails/:id/review", async (context) => {
            const id = context.req.param("id");
            const item = await repository.get(id);
            if (!item) {
                return context.json({ error: "Mail not found" }, 404);
            }
            if (item.status !== "ready") {
                return context.json(
                    { error: "Mail is not ready for review" },
                    409
                );
            }

            let body: unknown;
            try {
                body = await context.req.json();
            } catch {
                return context.json(
                    { error: "promotionDraft must be a non-empty string" },
                    400
                );
            }

            const parsed = ReviewMailRequestSchema.safeParse(body);
            if (!parsed.success) {
                return context.json(
                    { error: "promotionDraft must be a non-empty string" },
                    400
                );
            }

            if (!item.analysis) {
                return context.json(
                    { error: "Mail has no analysis available for review" },
                    409
                );
            }

            const reviewedAt = Timestamp.now();
            await repository.update(id, {
                status: "reviewed",
                reviewedAt,
                analysis: {
                    ...item.analysis,
                    promotionDraft: parsed.data.promotionDraft,
                },
            });

            const updated = await repository.get(id);
            if (!updated) {
                return context.json({ error: "Mail not found" }, 404);
            }
            return context.json(toMailApiItem(updated));
        })
        .post("/api/mails/:id/flag", async (context) => {
            const id = context.req.param("id");
            const item = await repository.get(id);
            if (!item) {
                return context.json({ error: "Mail not found" }, 404);
            }

            let body: unknown;
            try {
                body = await context.req.json();
            } catch {
                return context.json({ error: "Invalid JSON body" }, 400);
            }

            const parsed = FlagMailRequestSchema.safeParse(body);
            if (!parsed.success) {
                return context.json(
                    { error: "important flag is required" },
                    400
                );
            }

            await repository.update(id, {
                isImportant: parsed.data.important,
            });

            const updated = await repository.get(id);
            if (!updated) {
                return context.json({ error: "Mail not found" }, 404);
            }
            return context.json(toMailApiItem(updated));
        })
        .post("/api/compose", async (context) => {
            const credentials = parseImapBasicAuthorization(
                context.req.header("authorization")
            );
            if (!credentials) {
                return context.json(
                    { error: "IMAP credentials are required" },
                    401,
                    { "WWW-Authenticate": 'Basic realm="IMAP"' }
                );
            }

            let body: unknown;
            try {
                body = await context.req.json();
            } catch {
                return context.json({ error: "Invalid JSON body" }, 400);
            }

            const parsed = ComposeRequestSchema.safeParse(body);
            if (!parsed.success) {
                return context.json(
                    { error: "to, subject, and body are required" },
                    400
                );
            }

            try {
                const id = await repository.create({
                    senderName: credentials.account,
                    senderAddress: credentials.account,
                    recipients: parsed.data.to ?? [],
                    cc: parsed.data.cc ?? [],
                    bcc: parsed.data.bcc ?? [],
                    subject: parsed.data.subject,
                    textBody: parsed.data.body,
                    receivedAt: Timestamp.now(),
                    externalMessageId: null,
                    status: "sent",
                    processedAt: null,
                    reviewedAt: null,
                    failureMessage: null,
                    analysis: null,
                });

                const created = await repository.get(id);
                if (!created) {
                    return context.json(
                        { error: "Failed to create sent mail" },
                        500
                    );
                }
                return context.json(toMailApiItem(created), 201);
            } catch {
                return context.json({ error: "Failed to send mail" }, 500);
            }
        });
}
