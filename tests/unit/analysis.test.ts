import { describe, expect, it, vi, beforeEach, assert } from "vitest";
import type { MailAnalysis, MailItem } from "@/lib/mail-schema";
import type { MailImage } from "@server/mail-parser";

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
        ...overrides,
    };
}

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

    it("includes binary file parts when images are supplied", async () => {
        const item = sampleMailItem({ textBody: "" });
        const pngBytes = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        const images: MailImage[] = [
            { data: pngBytes, mediaType: "image/png" },
        ];
        mockGenerateText.mockResolvedValueOnce({ output: sampleAnalysis });

        const result = await analyzeMail(item, images);

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
        if (
            content[1] &&
            typeof content[1] === "object" &&
            "image" in content[1]
        ) {
            expect(content[1].image).toBe(pngBytes);
        }
    });

    it("rejects image-only mail retried without images", async () => {
        const item = sampleMailItem({ textBody: "", htmlBody: undefined });

        await expect(analyzeMail(item, [])).rejects.toThrow(
            "Image-only mail must be retried by synchronizing the inbox"
        );
        expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("still works with text body and images (mixed content)", async () => {
        const item = sampleMailItem({ textBody: "Hello" });
        const images: MailImage[] = [
            { data: new Uint8Array(4), mediaType: "image/jpeg" },
        ];
        mockGenerateText.mockResolvedValueOnce({ output: sampleAnalysis });

        const result = await analyzeMail(item, images);

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
