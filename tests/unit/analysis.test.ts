import { describe, expect, it, vi, beforeEach, assert } from "vitest";
import type { MailAnalysis, MailItem } from "@/lib/mail-schema";

const { mockGenerateText } = vi.hoisted(() => ({
    mockGenerateText: vi.fn(),
}));

vi.mock("ai", () => ({
    generateText: mockGenerateText,
    Output: {
        object: vi.fn(() => ({ type: "object" })),
    },
}));
import { analyzeMail } from "@server/analysis";

const mockTimestamp = {
    toDate: () => new Date("2026-07-24"),
    toMillis: () => 1721779200000,
    seconds: 1721779200,
    nanoseconds: 0,
} satisfies {
    toDate(): Date;
    toMillis(): number;
    readonly seconds: number;
    readonly nanoseconds: number;
};

const sampleAnalysis: MailAnalysis = {
    category: "직업훈련",
    audience: "대학생",
    schedule: null,
    applicationDeadline: null,
    benefits: "교육비 지원",
    applicationMethod: "온라인 신청",
    contactOrReference: null,
    reviewNotes: ["확인 필요"],
};

function sampleMailItem(overrides?: Partial<MailItem>): MailItem {
    return {
        id: "test-1",
        senderName: "발송자",
        senderAddress: "sender@example.invalid",
        recipients: ["recipient@example.invalid"],
        subject: "Image-only test",
        textBody: overrides?.textBody ?? "본문 내용",
        htmlBody: undefined,
        receivedAt: mockTimestamp,
        externalMessageId: "<test@example.invalid>",
        status: "queued",
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: null,
        draft: null,
        images: undefined,
        ...overrides,
    };
}

const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const pngBytes = new Uint8Array(Buffer.from(pngBase64, "base64"));

describe("analyzeMail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends text-only prompt when no images provided", async () => {
        const item = sampleMailItem();
        mockGenerateText.mockResolvedValueOnce({ output: sampleAnalysis });

        const result = await analyzeMail(item);

        expect(result).toEqual(sampleAnalysis);
        expect(mockGenerateText).toHaveBeenCalledTimes(1);

        const callArg = mockGenerateText.mock.calls[0]![0];
        assert(callArg != null);
        assert(typeof callArg === "object" && "prompt" in callArg);
        expect(typeof callArg.prompt).toBe("string");
    });

    it("includes image parts when item has images", async () => {
        const item = sampleMailItem({
            textBody: "",
            images: [{ data: pngBase64, mediaType: "image/png" }],
        });
        mockGenerateText.mockResolvedValueOnce({ output: sampleAnalysis });

        const result = await analyzeMail(item);

        expect(result).toEqual(sampleAnalysis);
        expect(mockGenerateText).toHaveBeenCalledTimes(1);

        const callArg = mockGenerateText.mock.calls[0]![0];
        assert(callArg != null);
        assert(typeof callArg === "object" && "messages" in callArg);
        const messages = callArg.messages;
        assert(Array.isArray(messages));
        assert(messages[0] != null && typeof messages[0] === "object");
        assert("content" in messages[0]);
        const content = messages[0].content;
        assert(Array.isArray(content));
        expect(content).toHaveLength(2);
        expect(content[0]).toMatchObject({ type: "text" });
        expect(content[1]).toMatchObject({
            type: "image",
            mimeType: "image/png",
        });
        // image is a Buffer decoded from base64 — compare bytes
        if (
            content[1] &&
            typeof content[1] === "object" &&
            "image" in content[1]
        ) {
            const decoded = content[1].image as Uint8Array;
            expect(new Uint8Array(decoded)).toEqual(pngBytes);
        }
    });

    it("rejects image-only mail with no images stored", async () => {
        const item = sampleMailItem({
            textBody: "",
            htmlBody: undefined,
            images: undefined,
        });

        await expect(analyzeMail(item)).rejects.toThrow(
            "Image-only mail must be retried by synchronizing the inbox"
        );
        expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("still works with text body and images (mixed content)", async () => {
        const item = sampleMailItem({
            textBody: "Hello",
            images: [{ data: pngBase64, mediaType: "image/jpeg" }],
        });
        mockGenerateText.mockResolvedValueOnce({ output: sampleAnalysis });

        const result = await analyzeMail(item);

        expect(result).toEqual(sampleAnalysis);
        expect(mockGenerateText).toHaveBeenCalledTimes(1);

        const callArg = mockGenerateText.mock.calls[0]![0];
        assert(callArg != null);
        assert(typeof callArg === "object" && "messages" in callArg);
        const messages = callArg.messages;
        assert(Array.isArray(messages));
        assert(messages[0] != null && typeof messages[0] === "object");
        assert("content" in messages[0]);
        assert(Array.isArray(messages[0].content));
        expect(messages[0].content).toHaveLength(2);
        expect(messages[0].content[0]).toMatchObject({ type: "text" });
        expect(messages[0].content[1]).toMatchObject({
            type: "image",
            mimeType: "image/jpeg",
        });
    });
});
