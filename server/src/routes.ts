import { Hono } from "hono";
import { Timestamp } from "firebase-admin/firestore";
import {
    ReviewMailRequestSchema,
    toMailApiItem,
} from "../../src/lib/mail-schema";
import { firestoreRepository, type MailRepository } from "./repository";

export type RouteDependencies = {
    repository?: MailRepository;
};

export function createRoutes(dependencies: RouteDependencies = {}): Hono {
    const repository = dependencies.repository ?? firestoreRepository;
    const app = new Hono();

    app.get("/healthz", (context) => context.json({ status: "ok" }));

    app.get("/api/mails", async (context) => {
        const items = await repository.list();
        return context.json(items.map(toMailApiItem));
    });

    app.get("/api/mails/:id", async (context) => {
        const id = context.req.param("id");
        const item = await repository.get(id);
        if (!item) {
            return context.json({ error: "Mail not found" }, 404);
        }
        return context.json(toMailApiItem(item));
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

    return app;
}
