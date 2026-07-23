import { Hono } from "hono";
import { Timestamp } from "firebase-admin/firestore";
import {
    ReviewMailRequestSchema,
    toMailApiItem,
} from "../../src/lib/mail-schema";
import { firestoreRepository, type MailRepository } from "./repository";
import { parseImapBasicAuthorization } from "./basic-auth";

export type RouteDependencies = {
    repository?: MailRepository;
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
        .post("/api/sync", (context) => {
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
            // P0c will wire up the actual syncInbox call
            return context.json({
                imported: 0,
                duplicates: 0,
                rejected: 0,
            });
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
        });
}
