import { describe, expect, it, vi } from "vitest";
import { createAttachedMailDataSource } from "../../src/lib/mail-data";
import { Timestamp } from "firebase/firestore";
import type { MailItem } from "../../src/lib/mail-schema";
describe("createAttachedMailDataSource", () => {
    it.concurrent("requests /api/mails and parses the response", async () => {
        const apiResponse = new Response(
            JSON.stringify([
                {
                    id: "test-1",
                    senderName: "테스터",
                    senderAddress: "tester@example.invalid",
                    recipients: ["user@example.invalid"],
                    subject: "API proxy test",
                    textBody: "Body content",
                    receivedAt: "2026-07-23T10:00:00.000Z",
                    processedAt: null,
                    reviewedAt: null,
                    externalMessageId: null,
                    status: "processing",
                    failureMessage: null,
                    analysis: null,
                },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

        const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(apiResponse);
        const source = createAttachedMailDataSource(fetchFn);

        const items = await source.list();

        expect(fetchFn).toHaveBeenCalledWith("/api/mails", {
            headers: {},
        });

        // Verify it parsed the response correctly
        expect(items).toHaveLength(1);
        const [first] = items;
        if (!first) {
            throw new Error("Expected at least one item");
        }
        expect(first.id).toBe("test-1");
        expect(first.subject).toBe("API proxy test");
        expect(first.senderName).toBe("테스터");
    });

    it.concurrent(
        "get() requests /api/mails/:id and returns null on 404",
        async () => {
            const notFoundResponse = new Response(null, { status: 404 });
            const fetchFn = vi
                .fn<typeof fetch>()
                .mockResolvedValue(notFoundResponse);
            const source = createAttachedMailDataSource(fetchFn);
            const result = await source.get("unknown-id");
            expect(fetchFn).toHaveBeenCalledWith("/api/mails/unknown-id", {
                headers: {},
            });
            expect(result).toBeNull();
        }
    );

    it.concurrent("get() returns a parsed item on 200", async () => {
        const apiResponse = new Response(
            JSON.stringify({
                id: "existing-1",
                senderName: "발신자",
                senderAddress: "sender@example.invalid",
                recipients: ["user@example.invalid"],
                subject: "Existing item",
                textBody: "Body",
                receivedAt: "2026-07-23T10:00:00.000Z",
                processedAt: "2026-07-23T10:01:00.000Z",
                reviewedAt: null,
                externalMessageId: null,
                status: "ready",
                failureMessage: null,
                analysis: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
        const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(apiResponse);
        const source = createAttachedMailDataSource(fetchFn);
        const result = await source.get("existing-1");
        expect(fetchFn).toHaveBeenCalledWith("/api/mails/existing-1", {
            headers: {},
        });
        if (!result) {
            throw new Error("Expected a mail item");
        }
        expect(result.id).toBe("existing-1");
        expect(result.subject).toBe("Existing item");
    });
});

it.concurrent(
    "sendReviewed() requests /api/mails/:id/send and parses the response",
    async () => {
        const apiResponse = new Response(
            JSON.stringify({
                source: {
                    id: "reviewed-1",
                    senderName: "미래직업교육원",
                    senderAddress: "notice@example.invalid",
                    recipients: ["promotion@example.invalid"],
                    subject: "Test subject",
                    textBody: "Original body",
                    receivedAt: "2026-07-23T10:00:00.000Z",
                    processedAt: null,
                    reviewedAt: "2026-07-23T11:00:00.000Z",
                    externalMessageId: null,
                    status: "dispatched",
                    failureMessage: null,
                    analysis: null,
                    draft: "Promotion draft",
                },
                sent: {
                    id: "sent-1",
                    senderName: "user@kangnam.ac.kr",
                    senderAddress: "user@kangnam.ac.kr",
                    recipients: [],
                    bcc: ["student@example.invalid"],
                    subject: "Test subject",
                    textBody: "Promotion draft",
                    receivedAt: "2026-07-23T12:00:00.000Z",
                    processedAt: null,
                    reviewedAt: null,
                    externalMessageId: null,
                    status: "sent",
                    failureMessage: null,
                    analysis: null,
                    draft: null,
                },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
        );

        const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(apiResponse);
        const source = createAttachedMailDataSource(fetchFn);

        const item: MailItem = {
            id: "reviewed-1",
            senderName: "미래직업교육원",
            senderAddress: "notice@example.invalid",
            recipients: ["promotion@example.invalid"],
            subject: "Test subject",
            textBody: "Original body",
            receivedAt: Timestamp.now(),
            externalMessageId: null,
            status: "reviewed",
            processedAt: null,
            reviewedAt: Timestamp.now(),
            failureMessage: null,
            analysis: null,
            draft: "Promotion draft",
        };

        const result = await source.sendReviewed(
            item,
            ["student@example.invalid"],
            "Basic dXNlckBrYW5nbmFtLmFjLmtyOnBhc3N3b3Jk"
        );
        expect(fetchFn).toHaveBeenCalledWith(
            "/api/mails/reviewed-1/send",
            expect.objectContaining({
                method: "POST",
                // oxlint-disable-next-line typescript/no-unsafe-assignment
                headers: expect.objectContaining({
                    authorization: "Basic dXNlckBrYW5nbmFtLmFjLmtyOnBhc3N3b3Jk",
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({ bcc: ["student@example.invalid"] }),
            })
        );
        expect(result.source.status).toBe("dispatched");
        expect(result.sent.status).toBe("sent");
        expect(result.sent.textBody).toBe("Promotion draft");
        expect(result.sent.bcc).toEqual(["student@example.invalid"]);
    }
);
