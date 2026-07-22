import { Hono } from "hono";
import { Timestamp } from "firebase-admin/firestore";
import { firestoreRepository, type MailRepository } from "./repository";

export type RouteDependencies = {
    repository?: MailRepository;
};

export function createRoutes(dependencies: RouteDependencies = {}): Hono {
    const repository = dependencies.repository ?? firestoreRepository;
    const app = new Hono();

    app.get("/healthz", (context) => context.json({ status: "ok" }));

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
