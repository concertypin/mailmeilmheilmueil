import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { MailAnalysisSchema, type MailItem } from "../../src/lib/mail-schema";
import { parseMailMessage, persistParsedMail } from "../../server/src/smtp-receiver";
import { AI_FAILURE_MESSAGE, processMailItem, type MailAnalyzer } from "../../server/src/processor";
import type { MailRepository, MailUpdate } from "../../server/src/repository";
import { createRoutes } from "../../server/src/routes";

const analysis = {
    category: "직업훈련" as const,
    audience: "데이터 분석 직무에 관심 있는 대학생",
    schedule: "2026-08-10~2026-08-14",
    applicationDeadline: "2026-07-31",
    benefits: "교육비 전액 지원, 수료증 발급",
    applicationMethod: "온라인 신청",
    contactOrReference: null,
    reviewNotes: ["신청 페이지 주소와 문의처는 게시 전 확인 필요"],
    promotionDraft: "대학생을 위한 데이터 분석 직무교육 참가자를 모집합니다.",
};

function sampleItem(status: MailItem["status"] = "queued"): MailItem {
    const timestamp = Timestamp.now();
    return {
        id: "mail-1",
        senderName: "미래직업교육원",
        senderAddress: "notice@example.invalid",
        recipients: ["promotion@example.invalid"],
        subject: "2026 여름 데이터 분석 직무교육 참가자 모집",
        textBody: "모집 대상: 데이터 분석 직무에 관심 있는 대학생",
        receivedAt: timestamp,
        externalMessageId: "<sample@example.invalid>",
        status,
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: status === "ready" || status === "reviewed" ? analysis : null,
    };
}

class FakeRepository implements MailRepository {
    item: MailItem;
    updates: MailUpdate[] = [];

    constructor(item = sampleItem()) {
        this.item = item;
    }

    create(): Promise<string> {
        return Promise.resolve(this.item.id);
    }

    get(): Promise<MailItem | null> {
        return Promise.resolve(this.item);
    }

    update(_id: string, update: MailUpdate): Promise<void> {
        this.updates.push(update);
        this.item = { ...this.item, ...update };
        return Promise.resolve();
    }
}

describe("MailAnalysisSchema", () => {
    it("accepts the complete structured response", () => {
        expect(MailAnalysisSchema.parse(analysis)).toEqual(analysis);
    });

    it("rejects invalid categories and dates", () => {
        expect(() => MailAnalysisSchema.parse({ ...analysis, category: "뉴스" })).toThrow("invalid_value");
        expect(() => MailAnalysisSchema.parse({ ...analysis, applicationDeadline: "2026/07/31" })).toThrow("Expected an ISO date");
    });
});

describe("SMTP parsing and processing", () => {
    it("normalizes an RFC 822 message without attachments", async () => {
        const raw = Buffer.from([
            "From: 미래직업교육원 <notice@example.invalid>",
            "To: promotion@example.invalid",
            "Subject: 테스트 제목",
            "Message-ID: <mail@example.invalid>",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "본문입니다.",
        ].join("\r\n"));
        const item = await parseMailMessage(raw, {
            mailFrom: { address: "notice@example.invalid", args: {} },
            rcptTo: [{ address: "promotion@example.invalid", args: {} }],
        });
        expect(item.senderAddress).toBe("notice@example.invalid");
        expect(item.subject).toBe("테스트 제목");
        expect(item.textBody).toBe("본문입니다.");
        expect(item.externalMessageId).toBe("<mail@example.invalid>");
        const repository = new FakeRepository();
        const persistedId = await persistParsedMail(raw, {
            mailFrom: { address: "notice@example.invalid", args: {} },
            rcptTo: [{ address: "promotion@example.invalid", args: {} }],
        }, repository);
        expect(persistedId).toBe("mail-1");
    });

    it("transitions queued mail to ready with injected analysis", async () => {
        const repository = new FakeRepository();
        const analyzer: MailAnalyzer = () => Promise.resolve(analysis);
        await processMailItem("mail-1", repository, analyzer);
        expect(repository.item.status).toBe("ready");
        expect(repository.item.analysis).toEqual(analysis);
        expect(repository.updates[0]).toMatchObject({ status: "processing" });
    });

    it("retains original mail and stores the safe failed state", async () => {
        const repository = new FakeRepository();
        const analyzer: MailAnalyzer = () => Promise.reject(new Error("provider unavailable"));
        await processMailItem("mail-1", repository, analyzer);
        expect(repository.item.status).toBe("failed");
        expect(repository.item.textBody).toBe("모집 대상: 데이터 분석 직무에 관심 있는 대학생");
        expect(repository.item.failureMessage).toBe(AI_FAILURE_MESSAGE);
        expect(repository.item.analysis).toBeNull();
    });
});

describe("review routes", () => {
    it("returns health and missing-item responses", async () => {
        const repository = new FakeRepository();
        const app = createRoutes(repository);
        expect((await app.request("/healthz")).status).toBe(200);
        const missing = new FakeRepository();
        missing.get = () => Promise.resolve(null);
        expect((await createRoutes(missing).request("/api/mails/nope/review", { method: "POST" })).status).toBe(404);
    });

    it("rejects non-ready mail and marks ready mail reviewed", async () => {
        const queued = new FakeRepository(sampleItem("queued"));
        expect((await createRoutes(queued).request("/api/mails/mail-1/review", { method: "POST" })).status).toBe(409);

        const ready = new FakeRepository(sampleItem("ready"));
        const response = await createRoutes(ready).request("/api/mails/mail-1/review", { method: "POST" });
        expect(response.status).toBe(200);
        expect(ready.item.status).toBe("reviewed");
        expect((await response.json())).toMatchObject({ id: "mail-1", status: "reviewed" });
    });
});
