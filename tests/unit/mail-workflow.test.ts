import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
import { MailAnalysisSchema, type MailItem } from "../../src/lib/mail-schema";
import {
    parseMailMessage,
    parseMailSource,
    persistParsedMail,
} from "../../server/src/smtp-receiver";
import {
    AI_FAILURE_MESSAGE,
    processMailItem,
    type MailAnalyzer,
} from "../../server/src/processor";
import type { MailRepository, MailUpdate } from "../../server/src/repository";
import { createRoutes } from "../../server/src/routes";
import {
    ImapCredentialError,
    ImapUnavailableError,
    syncInbox,
    type ImapClient,
    type ImapCredentials,
} from "../../server/src/imap";
import {
    createImapSession,
    getImapSession,
    type ImapSessionStore,
} from "../../server/src/imap-session";
import type { FetchMessageObject } from "imapflow";
import { createHash } from "node:crypto";

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

    createIfAbsent(): Promise<{ id: string; created: boolean }> {
        return Promise.resolve({ id: this.item.id, created: true });
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

class SyncRepository implements MailRepository {
    readonly items = new Map<string, MailItem>();
    readonly keys = new Map<string, string>();

    create(item: Omit<MailItem, "id">): Promise<string> {
        const id = `smtp-${this.items.size + 1}`;
        this.items.set(id, { id, ...item });
        return Promise.resolve(id);
    }

    createIfAbsent(
        item: Omit<MailItem, "id">,
        idempotencyKey: string
    ): Promise<{ id: string; created: boolean }> {
        const existingId = this.keys.get(idempotencyKey);
        if (existingId) {
            return Promise.resolve({ id: existingId, created: false });
        }
        const id = createHash("sha256").update(idempotencyKey).digest("hex");
        this.keys.set(idempotencyKey, id);
        this.items.set(id, { id, ...item });
        return Promise.resolve({ id, created: true });
    }

    get(id: string): Promise<MailItem | null> {
        return Promise.resolve(this.items.get(id) ?? null);
    }

    update(id: string, update: MailUpdate): Promise<void> {
        const item = this.items.get(id);
        if (item) {
            this.items.set(id, { ...item, ...update });
        }
        return Promise.resolve();
    }
}

class FakeImapClient implements ImapClient {
    mailbox: ImapClient["mailbox"] = { uidValidity: 99n };
    readonly fetched: number[] = [];
    readonly searchOptions: { uid: boolean }[] = [];
    readonly locks: {
        path: string;
        options: { readOnly: boolean; acquireTimeout: number };
    }[] = [];
    released = false;
    loggedOut = false;
    closed = false;
    private readonly messages: Array<FetchMessageObject | false>;

    constructor(messages: Array<FetchMessageObject | false>) {
        this.messages = [...messages];
    }

    connect(): Promise<void> {
        return Promise.resolve();
    }

    logout(): Promise<void> {
        this.loggedOut = true;
        return Promise.resolve();
    }

    close(): void {
        this.closed = true;
    }

    on(_event: "error", _listener: (error: Error) => void): ImapClient {
        return this;
    }

    getMailboxLock(
        path: string,
        options: { readOnly: boolean; acquireTimeout: number }
    ): Promise<{ release(): void }> {
        this.locks.push({ path, options });
        return Promise.resolve({
            release: () => {
                this.released = true;
            },
        });
    }

    search(
        _query: { seen: boolean },
        options: { uid: boolean }
    ): Promise<number[]> {
        this.searchOptions.push(options);
        return Promise.resolve(
            this.messages.map((_message, index) => 701 + index)
        );
    }

    fetchOne(uid: number): Promise<FetchMessageObject | false> {
        this.fetched.push(uid);
        return Promise.resolve(this.messages.shift() ?? false);
    }
}

class FakeSessionStore implements ImapSessionStore {
    credentials: ImapCredentials | null = {
        account: "portal@kangnam.ac.kr",
        password: "secret",
    };
    createBehavior: "ok" | "credential" | "unavailable" = "ok";
    deleted = 0;

    create(
        _portalId: string,
        _password: string
    ): Promise<{ token: string; account: string }> {
        if (this.createBehavior === "credential") {
            return Promise.reject(
                new ImapCredentialError("IMAP authentication failed")
            );
        }
        if (this.createBehavior === "unavailable") {
            return Promise.reject(
                new ImapUnavailableError("IMAP server is unavailable")
            );
        }
        return Promise.resolve({
            token: "opaque-token",
            account: "portal@kangnam.ac.kr",
        });
    }

    get(_token: string): ImapCredentials | null {
        return this.credentials;
    }

    delete(_token: string): void {
        this.deleted += 1;
        this.credentials = null;
    }
}

describe("MailAnalysisSchema", () => {
    it("accepts the complete structured response", () => {
        expect(MailAnalysisSchema.parse(analysis)).toEqual(analysis);
    });

    it("rejects invalid categories and dates", () => {
        expect(() =>
            MailAnalysisSchema.parse({ ...analysis, category: "뉴스" })
        ).toThrow("invalid_value");
        expect(() =>
            MailAnalysisSchema.parse({
                ...analysis,
                applicationDeadline: "2026/07/31",
            })
        ).toThrow("Expected an ISO date");
    });
});

describe("SMTP parsing and processing", () => {
    it("normalizes an RFC 822 message without attachments", async () => {
        const raw = Buffer.from(
            [
                "From: 미래직업교육원 <notice@example.invalid>",
                "To: promotion@example.invalid",
                "Subject: 테스트 제목",
                "Message-ID: <mail@example.invalid>",
                "Content-Type: text/plain; charset=utf-8",
                "",
                "본문입니다.",
            ].join("\r\n")
        );
        const item = await parseMailMessage(raw, {
            mailFrom: { address: "notice@example.invalid", args: {} },
            rcptTo: [{ address: "promotion@example.invalid", args: {} }],
        });
        expect(item.senderAddress).toBe("notice@example.invalid");
        const sourceItem = await parseMailSource(raw);
        expect(sourceItem.senderAddress).toBe("notice@example.invalid");
        expect(sourceItem.recipients).toEqual(["promotion@example.invalid"]);
        expect(item.subject).toBe("테스트 제목");
        expect(item.textBody).toBe("본문입니다.");
        expect(item.externalMessageId).toBe("<mail@example.invalid>");
        const repository = new FakeRepository();
        const persistedId = await persistParsedMail(
            raw,
            {
                mailFrom: { address: "notice@example.invalid", args: {} },
                rcptTo: [{ address: "promotion@example.invalid", args: {} }],
            },
            repository
        );
        expect(persistedId).toBe("mail-1");
    });

    it("converts an HTML-only message into reviewable text", async () => {
        const raw = Buffer.from(
            [
                "From: notice@example.invalid",
                "To: promotion@example.invalid",
                "Subject: HTML 공지",
                "Content-Type: text/html; charset=utf-8",
                "",
                "<html><body><h1>모집 안내</h1><p>HTML 본문입니다.</p></body></html>",
            ].join("\r\n")
        );
        const item = await parseMailSource(raw);
        expect(item.textBody).toContain("모집 안내");
        expect(item.textBody).toContain("HTML 본문입니다.");
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
        const analyzer: MailAnalyzer = () =>
            Promise.reject(new Error("provider unavailable"));
        await processMailItem("mail-1", repository, analyzer);
        expect(repository.item.status).toBe("failed");
        expect(repository.item.textBody).toBe(
            "모집 대상: 데이터 분석 직무에 관심 있는 대학생"
        );
        expect(repository.item.failureMessage).toBe(AI_FAILURE_MESSAGE);
        expect(repository.item.analysis).toBeNull();
    });
});
describe("IMAP synchronization", () => {
    const rawMessage = Buffer.from(
        [
            "From: 미래직업교육원 <notice@example.invalid>",
            "To: promotion@example.invalid",
            "Subject: IMAP 테스트",
            "Message-ID: <imap@example.invalid>",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "IMAP 본문입니다.",
        ].join("\r\n")
    );

    it("searches and fetches unseen messages by UID while rejecting malformed sources", async () => {
        const client = new FakeImapClient([
            { seq: 1, uid: 701, source: Buffer.from("invalid source") },
            { seq: 2, uid: 702 },
            {
                seq: 3,
                uid: 703,
                source: rawMessage,
                internalDate: new Date("2026-07-20T00:00:00Z"),
            },
        ]);
        const repository = new SyncRepository();
        const result = await syncInbox(
            { account: "portal@kangnam.ac.kr", password: "secret" },
            repository,
            () => Promise.resolve(analysis),
            () => client
        );
        expect(result).toEqual({ imported: 1, duplicates: 0, rejected: 2 });
        expect(client.searchOptions).toEqual([{ uid: true }]);
        expect(client.fetched).toEqual([701, 702, 703]);
        expect(client.locks).toEqual([
            {
                path: "INBOX",
                options: { readOnly: true, acquireTimeout: 30000 },
            },
        ]);
        expect(client.released).toBe(true);
        expect(client.loggedOut).toBe(true);
    });

    it("creates an IMAP message once and analyzes only newly created items", async () => {
        const repository = new SyncRepository();
        const clients: FakeImapClient[] = [];
        const factory = () => {
            const client = new FakeImapClient([
                { seq: 9, uid: 901, source: rawMessage },
            ]);
            clients.push(client);
            return client;
        };
        let analyzed = 0;
        const analyzer: MailAnalyzer = () => {
            analyzed += 1;
            return Promise.resolve(analysis);
        };
        const credentials = {
            account: "portal@kangnam.ac.kr",
            password: "secret",
        };
        expect(
            await syncInbox(credentials, repository, analyzer, factory)
        ).toEqual({ imported: 1, duplicates: 0, rejected: 0 });
        expect(
            await syncInbox(credentials, repository, analyzer, factory)
        ).toEqual({ imported: 0, duplicates: 1, rejected: 0 });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(repository.items.size).toBe(1);
        expect(
            clients.every((client) => client.released && client.loggedOut)
        ).toBe(true);
    });
});

describe("IMAP sessions", () => {
    it("expires and renews the in-memory password record with fake timers", async () => {
        vi.useFakeTimers();
        try {
            const verify = () => Promise.resolve();
            const created = await createImapSession("portal", "secret", verify);
            expect(getImapSession(created.token)).toEqual({
                account: "portal@kangnam.ac.kr",
                password: "secret",
            });
            vi.advanceTimersByTime(29 * 60 * 1000);
            expect(getImapSession(created.token)).not.toBeNull();
            vi.advanceTimersByTime(29 * 60 * 1000);
            expect(getImapSession(created.token)).not.toBeNull();
            vi.advanceTimersByTime(30 * 60 * 1000);
            expect(getImapSession(created.token)).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("IMAP routes", () => {
    it("rejects malformed and invalid login payloads", async () => {
        const sessions = new FakeSessionStore();
        const app = createRoutes({ imapSessions: sessions });
        expect(
            (
                await app.request("/api/imap/login", {
                    method: "POST",
                    body: "not-json",
                })
            ).status
        ).toBe(400);
        expect(
            (
                await app.request("/api/imap/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        portalId: "portal@example.com",
                        password: "secret",
                    }),
                })
            ).status
        ).toBe(400);
    });

    it("maps login failures and never returns the opaque token", async () => {
        const credentialSessions = new FakeSessionStore();
        credentialSessions.createBehavior = "credential";
        const credentialResponse = await createRoutes({
            imapSessions: credentialSessions,
        }).request("/api/imap/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ portalId: "portal", password: "secret" }),
        });
        expect(credentialResponse.status).toBe(401);
        expect(await credentialResponse.json()).toEqual({
            error: "IMAP authentication failed",
        });

        const unavailableSessions = new FakeSessionStore();
        unavailableSessions.createBehavior = "unavailable";
        expect(
            (
                await createRoutes({
                    imapSessions: unavailableSessions,
                }).request("/api/imap/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        portalId: "portal",
                        password: "secret",
                    }),
                })
            ).status
        ).toBe(502);

        const successful = await createRoutes({
            imapSessions: new FakeSessionStore(),
        }).request("/api/imap/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ portalId: "portal", password: "secret" }),
        });
        expect(successful.status).toBe(200);
        expect(await successful.json()).toEqual({
            account: "portal@kangnam.ac.kr",
        });
        expect(successful.headers.get("set-cookie")).toContain(
            "imapSession=opaque-token"
        );
        expect(successful.headers.get("set-cookie")).toContain("HttpOnly");
    });

    it("clears invalid sessions and forwards valid sync credentials", async () => {
        const missingSessions = new FakeSessionStore();
        const missing = await createRoutes({
            imapSessions: missingSessions,
        }).request("/api/imap/sync", { method: "POST" });
        expect(missing.status).toBe(401);
        expect(missing.headers.get("set-cookie")).toContain("Max-Age=0");

        const sessions = new FakeSessionStore();
        let received: ImapCredentials | null = null;
        const response = await createRoutes({
            imapSessions: sessions,
            syncInbox: (credentials) => {
                received = credentials;
                return Promise.resolve({
                    imported: 2,
                    duplicates: 3,
                    rejected: 4,
                });
            },
        }).request("/api/imap/sync", {
            method: "POST",
            headers: { Cookie: "imapSession=opaque-token" },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get("set-cookie")).toContain("Max-Age=1800");
        expect(await response.json()).toEqual({
            imported: 2,
            duplicates: 3,
            rejected: 4,
        });
        expect(received).toEqual({
            account: "portal@kangnam.ac.kr",
            password: "secret",
        });
    });

    it("deletes a session after IMAP authentication fails during sync", async () => {
        const sessions = new FakeSessionStore();
        const response = await createRoutes({
            imapSessions: sessions,
            syncInbox: () =>
                Promise.reject(
                    new ImapCredentialError("IMAP authentication failed")
                ),
        }).request("/api/imap/sync", {
            method: "POST",
            headers: { Cookie: "imapSession=opaque-token" },
        });
        expect(response.status).toBe(401);
        expect(sessions.deleted).toBe(1);
        expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    });
});

describe("review routes", () => {
    it("returns health and missing-item responses", async () => {
        const repository = new FakeRepository();
        const app = createRoutes({ repository });
        expect((await app.request("/healthz")).status).toBe(200);
        const missing = new FakeRepository();
        missing.get = () => Promise.resolve(null);
        expect(
            (
                await createRoutes({ repository: missing }).request(
                    "/api/mails/nope/review",
                    { method: "POST" }
                )
            ).status
        ).toBe(404);
    });

    it("rejects non-ready mail and marks ready mail reviewed", async () => {
        const queued = new FakeRepository(sampleItem("queued"));
        expect(
            (
                await createRoutes({ repository: queued }).request(
                    "/api/mails/mail-1/review",
                    { method: "POST" }
                )
            ).status
        ).toBe(409);

        const ready = new FakeRepository(sampleItem("ready"));
        const response = await createRoutes({ repository: ready }).request(
            "/api/mails/mail-1/review",
            { method: "POST" }
        );
        expect(response.status).toBe(200);
        expect(ready.item.status).toBe("reviewed");
        expect(await response.json()).toMatchObject({
            id: "mail-1",
            status: "reviewed",
        });
    });
});
