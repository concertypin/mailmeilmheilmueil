import type { FetchMessageObject } from "imapflow";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    MailAnalysisSchema,
    MailApiItemSchema,
    type MailItem,
} from "@/lib/mail-schema";
import { parseMailSource } from "@server/mail-parser";
import { processMailItem, type MailAnalyzer } from "@server/processor";
import {
    type AnalysisCriteriaRepository,
    type AnalysisCriteria,
} from "@server/criteria";
import type { MailRepository, MailUpdate } from "@server/repository";
import { createRoutes } from "@server/routes";
import {
    ImapCredentialError,
    ImapUnavailableError,
    syncInbox,
    type ImapClient,
    type ImapCredentials,
    type ImapSyncResult,
} from "@server/imap";
import {
    credentialsFromEnv,
    main,
    runSync,
    type SyncEnvironment,
} from "@server/sync-main";
const analysis = {
    category: "직업훈련" as const,
    audience: "데이터 분석 직무에 관심 있는 대학생",
    schedule: "2026-08-10~2026-08-14",
    applicationDeadline: "2026-07-31",
    benefits: "교육비 전액 지원, 수료증 발급",
    applicationMethod: "온라인 신청",
    contactOrReference: null,
    reviewNotes: ["신청 페이지 주소와 문의처는 게시 전 확인 필요"],
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
        htmlBody: undefined,
        receivedAt: timestamp,
        externalMessageId: "<sample@example.invalid>",
        status,
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: status === "ready" || status === "reviewed" ? analysis : null,
        images: undefined,
        draft: null,
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
    list(): Promise<MailItem[]> {
        return Promise.resolve([this.item]);
    }
}
class FakeCriteriaRepository implements AnalysisCriteriaRepository {
    get(_account: string): Promise<AnalysisCriteria> {
        return Promise.resolve({
            disabledDefaultKeys: [],
            customFields: [],
        });
    }
    save(
        _account: string,
        criteria: AnalysisCriteria
    ): Promise<AnalysisCriteria> {
        return Promise.resolve(criteria);
    }
}

class SyncRepository implements MailRepository {
    readonly items = new Map<string, MailItem>();
    readonly keys = new Map<string, string>();
    failCreate = false;
    failUpdate = false;

    create(item: Omit<MailItem, "id">): Promise<string> {
        const id = `mail-${this.items.size + 1}`;
        this.items.set(id, { id, ...item });
        return Promise.resolve(id);
    }

    createIfAbsent(
        item: Omit<MailItem, "id">,
        idempotencyKey: string
    ): Promise<{ id: string; created: boolean }> {
        if (this.failCreate) {
            return Promise.reject(new Error("Firestore unavailable"));
        }
        const existingId = this.keys.get(idempotencyKey);
        if (existingId) {
            return Promise.resolve({ id: existingId, created: false });
        }
        const id = `mail-${this.items.size + 1}`;
        this.keys.set(idempotencyKey, id);
        this.items.set(id, { id, ...item });
        return Promise.resolve({ id, created: true });
    }

    get(id: string): Promise<MailItem | null> {
        return Promise.resolve(this.items.get(id) ?? null);
    }

    update(id: string, update: MailUpdate): Promise<void> {
        if (this.failUpdate) {
            return Promise.reject(new Error("Firestore update unavailable"));
        }
        const item = this.items.get(id);
        if (item) {
            this.items.set(id, { ...item, ...update });
        }
        return Promise.resolve();
    }
    list(): Promise<MailItem[]> {
        return Promise.resolve(
            Array.from(this.items.values()).sort(
                (a, b) => b.receivedAt.toMillis() - a.receivedAt.toMillis()
            )
        );
    }
}

class FakeImapClient implements ImapClient {
    mailbox: ImapClient["mailbox"];
    readonly fetched: number[] = [];
    readonly searchOptions: { uid: boolean }[] = [];
    readonly locks: {
        path: string;
        options: { readOnly: boolean; acquireTimeout: number };
    }[] = [];
    readonly flagCalls: {
        range: number;
        flags: string[];
        options: { uid: boolean };
    }[] = [];
    released = false;
    loggedOut = false;
    closed = false;
    flagError = false;
    private readonly messages: Map<number, FetchMessageObject | false>;

    constructor(
        messages: Array<FetchMessageObject | false>,
        uidValidity = 99n
    ) {
        this.mailbox = { uidValidity };
        this.messages = new Map(
            messages.map((entry, index) => {
                const uid =
                    entry === false || entry.uid === undefined
                        ? 701 + index
                        : entry.uid;
                return [uid, entry];
            })
        );
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
        return Promise.resolve([...this.messages.keys()]);
    }

    fetchOne(uid: number): Promise<FetchMessageObject | false> {
        this.fetched.push(uid);
        return Promise.resolve(this.messages.get(uid) ?? false);
    }

    messageFlagsAdd(
        range: number,
        flags: string[],
        options: { uid: boolean }
    ): Promise<boolean> {
        if (this.flagError) {
            return Promise.reject(new Error("IMAP flag update failed"));
        }
        this.flagCalls.push({ range, flags, options });
        return Promise.resolve(true);
    }
}

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

function message(uid: number, source = rawMessage): FetchMessageObject {
    return { seq: uid, uid, source };
}

function completeEnvironment(): SyncEnvironment {
    return {
        IMAP_HOST: "imap.example.invalid",
        IMAP_PORT: "993",
        IMAP_SECURE: "true",
        IMAP_ACCOUNT: "inbox@example.invalid",
        IMAP_PASSWORD: "imap-secret",
    };
}

describe("MailAnalysisSchema", () => {
    it("accepts the complete structured response", () => {
        expect(MailAnalysisSchema.parse(analysis)).toEqual(analysis);
    });

    it("accepts any string values for any keys", () => {
        const result = MailAnalysisSchema.parse({
            ...analysis,
            category: "뉴스",
            applicationDeadline: "2026/07/31",
            customKey: "any_value",
        });
        expect(result.category).toBe("뉴스");
        expect(result.applicationDeadline).toBe("2026/07/31");
        expect(result.customKey).toBe("any_value");
        expect(result.reviewNotes).toEqual([
            "신청 페이지 주소와 문의처는 게시 전 확인 필요",
        ]);
    });
});

describe("mail parsing and processing", () => {
    it("normalizes RFC 822 text and HTML-only messages", async () => {
        const { item, images } = await parseMailSource(rawMessage);
        expect(item.senderAddress).toBe("notice@example.invalid");
        expect(item.recipients).toEqual(["promotion@example.invalid"]);
        expect(item.subject).toBe("IMAP 테스트");
        expect(item.textBody).toBe("IMAP 본문입니다.");
        expect(item.externalMessageId).toBe("<imap@example.invalid>");
        expect(images).toEqual([]);

        const html = Buffer.from(
            [
                "From: notice@example.invalid",
                "To: promotion@example.invalid",
                "Subject: HTML 공지",
                "Content-Type: text/html; charset=utf-8",
                "",
                "<html><body><h1>모집 안내</h1><p>HTML 본문입니다.</p></body></html>",
            ].join("\r\n")
        );
        const { item: htmlItem, images: htmlImages } =
            await parseMailSource(html);
        expect(htmlItem.textBody).toContain("모집 안내");
        expect(htmlItem.textBody).toContain("HTML 본문입니다.");
        expect(htmlImages).toEqual([]);
    });

    it("transitions queued mail to ready with injected analysis", async () => {
        const repository = new FakeRepository();
        const analyzer: MailAnalyzer = () => Promise.resolve(analysis);
        await processMailItem("mail-1", repository, { analyzer });
        expect(repository.item.status).toBe("ready");
        expect(repository.item.analysis).toEqual(analysis);
        expect(repository.updates[0]).toMatchObject({ status: "processing" });
    });

    it("retains original mail and stores the safe failed state", async () => {
        const repository = new FakeRepository();
        const analyzer: MailAnalyzer = () =>
            Promise.reject(new Error("provider unavailable"));
        await processMailItem("mail-1", repository, { analyzer });
        expect(repository.item.status).toBe("failed");
        expect(repository.item.textBody).toBe(
            "모집 대상: 데이터 분석 직무에 관심 있는 대학생"
        );
        expect(repository.item.failureMessage).toBe(
            "AI 분석 실패: provider unavailable"
        );
        expect(repository.item.analysis).toBeNull();
    });

    it("accepts an image-only RFC 822 message with no text body", async () => {
        const pngBase64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const pngBytes = Buffer.from(pngBase64, "base64");
        const imageOnlyRaw = Buffer.from(
            [
                "From: sender@example.invalid",
                "To: recipient@example.invalid",
                "Subject: Image-only promo",
                "MIME-Version: 1.0",
                'Content-Type: multipart/mixed; boundary="==BOUNDARY=="',
                "",
                "--==BOUNDARY==",
                "Content-Type: image/png",
                "Content-Transfer-Encoding: base64",
                "Content-Disposition: inline",
                "",
                pngBase64,
                "--==BOUNDARY==--",
            ].join("\r\n")
        );
        const { item, images } = await parseMailSource(imageOnlyRaw);
        expect(item.textBody).toBe("");
        expect(item.images).toHaveLength(1);
        expect(item.images![0]!.data).toBe(pngBase64);
        expect(item.images![0]!.mediaType).toBe("image/png");
        expect(item.subject).toBe("Image-only promo");
        expect(item.senderAddress).toBe("sender@example.invalid");
        expect(images).toHaveLength(1);
        expect(images[0]!.mediaType).toBe("image/png");
        expect(new Uint8Array(images[0]!.data)).toEqual(
            new Uint8Array(pngBytes)
        );
    });

    it("rejects a bodyless message with no image attachments", async () => {
        const noContent = Buffer.from(
            [
                "From: sender@example.invalid",
                "To: recipient@example.invalid",
                "Subject: No content",
                "",
                "   ",
            ].join("\r\n")
        );
        await expect(parseMailSource(noContent)).rejects.toThrow(
            "Message has no usable text body or image attachment"
        );
    });
});

describe("IMAP synchronization", () => {
    it("waits for analysis and marks a new message seen by UID", async () => {
        const client = new FakeImapClient([message(701)]);
        const repository = new SyncRepository();
        let analyzed = 0;
        const result = await syncInbox(
            { account: "inbox@example.invalid", password: "secret" },
            repository,
            {
                analyzer: () => {
                    analyzed += 1;
                    return Promise.resolve(analysis);
                },
                clientFactory: () => client,
            }
        );

        expect(result).toEqual({ imported: 1, duplicates: 0, rejected: 0 });
        expect(analyzed).toBe(1);
        expect(repository.items.get("mail-1")?.status).toBe("ready");
        expect(repository.items.get("mail-1")?.mailboxAccount).toBe(
            "inbox@example.invalid"
        );
        expect(client.locks[0]).toEqual({
            path: "INBOX",
            options: { readOnly: false, acquireTimeout: 30000 },
        });
        expect(client.flagCalls).toEqual([
            { range: 701, flags: ["\\Seen"], options: { uid: true } },
        ]);
        expect(client.released).toBe(true);
        expect(client.loggedOut).toBe(true);
    });

    it("uses the UID idempotency key on a second run without re-analyzing", async () => {
        const repository = new SyncRepository();
        let analyzed = 0;
        const analyzer: MailAnalyzer = () => {
            analyzed += 1;
            return Promise.resolve(analysis);
        };
        const credentials = {
            account: "inbox@example.invalid",
            password: "secret",
        };
        const firstClient = new FakeImapClient([message(701)]);
        const secondClient = new FakeImapClient([message(701)]);

        expect(
            await syncInbox(credentials, repository, {
                analyzer,
                clientFactory: () => firstClient,
            })
        ).toEqual({ imported: 1, duplicates: 0, rejected: 0 });
        expect(
            await syncInbox(credentials, repository, {
                analyzer,
                clientFactory: () => secondClient,
            })
        ).toEqual({ imported: 0, duplicates: 1, rejected: 0 });
        expect(analyzed).toBe(1);
        expect(repository.items.size).toBe(1);
        expect(secondClient.flagCalls).toEqual([
            { range: 701, flags: ["\\Seen"], options: { uid: true } },
        ]);
    });

    it("imports a new message when UIDVALIDITY changes", async () => {
        const repository = new SyncRepository();
        let analyzed = 0;
        const analyzer: MailAnalyzer = () => {
            analyzed += 1;
            return Promise.resolve(analysis);
        };
        const credentials = {
            account: "inbox@example.invalid",
            password: "secret",
        };
        const firstClient = new FakeImapClient([message(801)], 99n);
        const secondClient = new FakeImapClient([message(801)], 100n);

        expect(
            await syncInbox(credentials, repository, {
                analyzer,
                clientFactory: () => firstClient,
            })
        ).toEqual({ imported: 1, duplicates: 0, rejected: 0 });
        expect(
            await syncInbox(credentials, repository, {
                analyzer,
                clientFactory: () => secondClient,
            })
        ).toEqual({ imported: 1, duplicates: 0, rejected: 0 });
        expect(analyzed).toBe(2);
        expect(repository.items.size).toBe(2);
    });

    it("leaves AI failures unseen and retries failed items", async () => {
        const repository = new SyncRepository();
        const firstClient = new FakeImapClient([message(802)]);
        const secondClient = new FakeImapClient([message(802)]);
        let attempts = 0;

        const firstResult = await syncInbox(
            { account: "inbox@example.invalid", password: "secret" },
            repository,
            {
                analyzer: () => {
                    attempts += 1;
                    return attempts === 1
                        ? Promise.reject(new Error("AI provider unavailable"))
                        : Promise.resolve(analysis);
                },
                clientFactory: () => firstClient,
            }
        );
        expect(firstResult).toEqual({
            imported: 1,
            duplicates: 0,
            rejected: 0,
        });
        expect(repository.items.get("mail-1")?.status).toBe("failed");
        expect(firstClient.flagCalls).toEqual([
            { range: 802, flags: ["\\Seen"], options: { uid: true } },
        ]);

        expect(
            await syncInbox(
                { account: "inbox@example.invalid", password: "secret" },
                repository,
                {
                    analyzer: () => Promise.resolve(analysis),
                    clientFactory: () => secondClient,
                }
            )
        ).toEqual({ imported: 0, duplicates: 1, rejected: 0 });
        expect(repository.items.get("mail-1")?.status).toBe("ready");
        expect(secondClient.flagCalls).toEqual([
            { range: 802, flags: ["\\Seen"], options: { uid: true } },
        ]);
    });

    it("rejects malformed messages and marks them seen", async () => {
        const client = new FakeImapClient([
            message(701, Buffer.from("invalid")),
        ]);
        const result = await syncInbox(
            { account: "inbox@example.invalid", password: "secret" },
            new SyncRepository(),
            {
                analyzer: () => Promise.resolve(analysis),
                clientFactory: () => client,
            }
        );

        expect(result).toEqual({ imported: 0, duplicates: 0, rejected: 1 });
        expect(client.flagCalls).toEqual([
            { range: 701, flags: ["\\Seen"], options: { uid: true } },
        ]);
    });

    it("leaves a message unseen when persistence fails", async () => {
        const client = new FakeImapClient([message(703)]);
        const repository = new SyncRepository();
        repository.failCreate = true;

        await expect(
            syncInbox(
                { account: "inbox@example.invalid", password: "secret" },
                repository,
                {
                    analyzer: () => Promise.resolve(analysis),
                    clientFactory: () => client,
                }
            )
        ).rejects.toBeInstanceOf(ImapUnavailableError);
        expect(client.flagCalls).toEqual([]);
    });

    it("leaves a message unseen when flag mutation fails", async () => {
        const client = new FakeImapClient([message(704)]);
        client.flagError = true;

        await expect(
            syncInbox(
                { account: "inbox@example.invalid", password: "secret" },
                new SyncRepository(),
                {
                    analyzer: () => Promise.resolve(analysis),
                    clientFactory: () => client,
                }
            )
        ).rejects.toBeInstanceOf(ImapUnavailableError);
        expect(client.flagCalls).toEqual([]);
    });

    it("imports an image-only message and stores images in the item", async () => {
        const pngBase64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const imageOnlyRaw = Buffer.from(
            [
                "From: sender@example.invalid",
                "To: recipient@example.invalid",
                "Subject: Image-only promo",
                "MIME-Version: 1.0",
                'Content-Type: multipart/mixed; boundary="==BOUNDARY=="',
                "",
                "--==BOUNDARY==",
                "Content-Type: image/png",
                "Content-Transfer-Encoding: base64",
                "Content-Disposition: inline",
                "",
                pngBase64,
                "--==BOUNDARY==--",
            ].join("\r\n")
        );
        const client = new FakeImapClient([
            { seq: 901, uid: 901, source: imageOnlyRaw },
        ]);
        const repository = new SyncRepository();
        const result = await syncInbox(
            { account: "inbox@example.invalid", password: "secret" },
            repository,
            {
                analyzer: () => Promise.resolve(analysis),
                clientFactory: () => client,
            }
        );
        expect(result).toEqual({ imported: 1, duplicates: 0, rejected: 0 });
        const stored = repository.items.get("mail-1");
        expect(stored?.status).toBe("ready");
        expect(stored?.textBody).toBe("");
        expect(stored?.images).toHaveLength(1);
        expect(stored?.images![0]!.data).toBe(pngBase64);
        expect(stored?.images![0]!.mediaType).toBe("image/png");
        expect(stored?.analysis).toEqual(analysis);
    });
});
describe("Heroku Scheduler sync configuration", () => {
    it("passes the configured mailbox credentials to the sync runner", async () => {
        let received: { account: string; password: string } | undefined;
        const result = await runSync(completeEnvironment(), (credentials) => {
            received = credentials;
            return Promise.resolve({ imported: 1, duplicates: 0, rejected: 0 });
        });
        expect(received).toEqual({
            account: "inbox@example.invalid",
            password: "imap-secret",
        });
        expect(result).toEqual({ imported: 1, duplicates: 0, rejected: 0 });
    });

    it.each(["IMAP_HOST", "IMAP_ACCOUNT", "IMAP_PASSWORD"] as const)(
        "rejects missing %s without exposing the password",
        (key) => {
            const environment = completeEnvironment();
            delete environment[key];
            expect(() => credentialsFromEnv(environment)).toThrow(key);
            expect(() => credentialsFromEnv(environment)).not.toThrow(
                "imap-secret"
            );
        }
    );

    it("rejects invalid port and secure settings", () => {
        expect(() =>
            credentialsFromEnv({ ...completeEnvironment(), IMAP_PORT: "0" })
        ).toThrow("IMAP_PORT");
        expect(() =>
            credentialsFromEnv({
                ...completeEnvironment(),
                IMAP_SECURE: "yes",
            })
        ).toThrow("IMAP_SECURE");
    });

    it("prints exactly one JSON result line on success", async () => {
        const output: string[] = [];
        const stdoutSpy = vi
            .spyOn(process.stdout, "write")
            .mockImplementation((chunk) => {
                output.push(String(chunk));
                return true;
            });
        try {
            expect(
                await main(completeEnvironment(), () =>
                    Promise.resolve({
                        imported: 1,
                        duplicates: 2,
                        rejected: 3,
                    })
                )
            ).toBe(0);
            expect(output).toEqual([
                '{"imported":1,"duplicates":2,"rejected":3}\n',
            ]);
        } finally {
            stdoutSpy.mockRestore();
        }
    });
    it.each([
        [
            new ImapCredentialError("authentication details must stay private"),
            "IMAP authentication failed",
        ],
        [
            new ImapUnavailableError("connection details must stay private"),
            "IMAP server is unavailable",
        ],
    ] as const)(
        "returns a nonzero outcome for %s",
        async (error, expectedMessage) => {
            const originalExitCode = process.exitCode;
            process.exitCode = 0;
            const stdout: string[] = [];
            const stderr: string[] = [];
            const stdoutSpy = vi
                .spyOn(process.stdout, "write")
                .mockImplementation((chunk) => {
                    stdout.push(String(chunk));
                    return true;
                });
            const stderrSpy = vi
                .spyOn(process.stderr, "write")
                .mockImplementation((chunk) => {
                    stderr.push(String(chunk));
                    return true;
                });
            try {
                expect(
                    await main(completeEnvironment(), () =>
                        Promise.reject(error)
                    )
                ).toBe(1);
                expect(stdout).toEqual([]);
                expect(stderr).toEqual([`${expectedMessage}\n`]);
                expect(stderr.join("")).not.toContain("imap-secret");
            } finally {
                stdoutSpy.mockRestore();
                stderrSpy.mockRestore();
                process.exitCode = originalExitCode;
            }
        }
    );
});

describe("review routes", () => {
    it("returns health and missing-item responses", async () => {
        const repository = new FakeRepository();
        expect(
            (await createRoutes({ repository }).request("/healthz")).status
        ).toBe(200);
        const missing = new FakeRepository();
        missing.get = () => Promise.resolve(null);
        const response = await createRoutes({ repository: missing }).request(
            "/api/mails/nope/review",
            { method: "POST" }
        );
        expect(response.status).toBe(404);
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
            {
                method: "POST",
                body: JSON.stringify({
                    promotionDraft: "  Trimmed draft  ",
                }),
                headers: { "Content-Type": "application/json" },
            }
        );
        expect(response.status).toBe(200);
        expect(ready.item.draft).toBe("Trimmed draft");
        const body = MailApiItemSchema.parse(await response.json());
        expect(body.id).toBe("mail-1");
        expect(body.status).toBe("reviewed");
        expect(typeof body.reviewedAt).toBe("string");
    });

    it("rejects malformed or empty review body with 400", async () => {
        const ready = new FakeRepository(sampleItem("ready"));

        const malformed = await createRoutes({ repository: ready }).request(
            "/api/mails/mail-1/review",
            {
                method: "POST",
                body: "not json",
                headers: { "Content-Type": "application/json" },
            }
        );
        expect(malformed.status).toBe(400);
        expect(await malformed.json()).toMatchObject({
            error: "promotionDraft must be a non-empty string",
        });

        const missing = await createRoutes({ repository: ready }).request(
            "/api/mails/mail-1/review",
            {
                method: "POST",
                body: JSON.stringify({}),
                headers: { "Content-Type": "application/json" },
            }
        );
        expect(missing.status).toBe(400);

        const blank = await createRoutes({ repository: ready }).request(
            "/api/mails/mail-1/review",
            {
                method: "POST",
                body: JSON.stringify({ promotionDraft: "   " }),
                headers: { "Content-Type": "application/json" },
            }
        );
        expect(blank.status).toBe(400);
    });

    it("rejects ready item without analysis with 409", async () => {
        const corrupt = new FakeRepository();
        corrupt.item = {
            ...corrupt.item,
            status: "ready" as const,
            analysis: null,
        };
        const response = await createRoutes({ repository: corrupt }).request(
            "/api/mails/mail-1/review",
            {
                method: "POST",
                body: JSON.stringify({ promotionDraft: "Valid draft" }),
                headers: { "Content-Type": "application/json" },
            }
        );
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
            error: "Mail has no analysis available for review",
        });
    });
});

describe("mail list and get routes", () => {
    it("GET /api/mails returns items in descending receivedAt order", async () => {
        const repository = new SyncRepository();
        const earlier: MailItem = {
            ...sampleItem("queued"),
            id: "earlier",
            receivedAt: Timestamp.fromMillis(1000),
        };
        const later: MailItem = {
            ...sampleItem("ready"),
            id: "later",
            receivedAt: Timestamp.fromMillis(2000),
        };
        repository.items.set("earlier", earlier);
        repository.items.set("later", later);

        const response = await createRoutes({ repository }).request(
            "/api/mails"
        );
        expect(response.status).toBe(200);
        const items = MailApiItemSchema.array().parse(await response.json());
        expect(items).toHaveLength(2);
        expect(items.map((i) => i.id)).toEqual(["later", "earlier"]);
        for (const item of items) {
            expect(typeof item.receivedAt).toBe("string");
        }
    });

    it("GET /api/mails/:id returns a serialized item", async () => {
        const repository = new SyncRepository();
        const item: MailItem = {
            ...sampleItem("ready"),
            id: "mail-1",
        };
        repository.items.set("mail-1", item);

        const response = await createRoutes({ repository }).request(
            "/api/mails/mail-1"
        );
        expect(response.status).toBe(200);
        const body = MailApiItemSchema.parse(await response.json());
        expect(body.id).toBe("mail-1");
        expect(body.status).toBe("ready");
    });

    it("GET /api/mails/:id returns 404 for unknown id", async () => {
        const response = await createRoutes({
            repository: new SyncRepository(),
        }).request("/api/mails/unknown");
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
            error: "Mail not found",
        });
    });
});

describe("POST /api/login — Basic auth", () => {
    const routes = createRoutes({
        testCredentials: async () => {},
    });

    it("returns 204 for valid Basic credentials", async () => {
        const encoded = Buffer.from("user@example.com:secret").toString(
            "base64"
        );
        const response = await routes.request("/api/login", {
            method: "POST",
            headers: { authorization: `Basic ${encoded}` },
        });
        expect(response.status).toBe(204);
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("returns 204 for UTF-8 credentials", async () => {
        const encoded = Buffer.from(
            "user@강남대학교:비밀번호!",
            "utf-8"
        ).toString("base64");
        const response = await routes.request("/api/login", {
            method: "POST",
            headers: { authorization: `Basic ${encoded}` },
        });
        expect(response.status).toBe(204);
    });

    it("returns 204 for lowercase 'basic' scheme", async () => {
        const encoded = Buffer.from("user:pass").toString("base64");
        const response = await routes.request("/api/login", {
            method: "POST",
            headers: { authorization: `basic ${encoded}` },
        });
        expect(response.status).toBe(204);
    });

    it("returns 401 for missing Authorization header", async () => {
        const response = await routes.request("/api/login", { method: "POST" });
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({
            error: "IMAP credentials are required",
        });
        expect(response.headers.get("www-authenticate")).toBe(
            'Basic realm="IMAP"'
        );
    });

    it("returns 401 for non-Basic scheme", async () => {
        const response = await routes.request("/api/login", {
            method: "POST",
            headers: { authorization: "Bearer token123" },
        });
        expect(response.status).toBe(401);
    });

    it("returns 401 for malformed base64", async () => {
        const response = await routes.request("/api/login", {
            method: "POST",
            headers: { authorization: "Basic not-base64!!!" },
        });
        expect(response.status).toBe(401);
    });

    it("returns 401 for blank account", async () => {
        const encoded = Buffer.from(":secret").toString("base64");
        const response = await routes.request("/api/login", {
            method: "POST",
            headers: { authorization: `Basic ${encoded}` },
        });
        expect(response.status).toBe(401);
    });

    it("returns 401 for blank password", async () => {
        const encoded = Buffer.from("user:").toString("base64");
        const response = await routes.request("/api/login", {
            method: "POST",
            headers: { authorization: `Basic ${encoded}` },
        });
        expect(response.status).toBe(401);
    });
});

describe("POST /api/sync — Basic auth", () => {
    const fakeSync =
        vi.fn<
            (
                _credentials: ImapCredentials,
                _repository: MailRepository
            ) => Promise<ImapSyncResult>
        >();
    const routes = createRoutes({
        repository: new FakeRepository(),
        criteriaRepository: new FakeCriteriaRepository(),
        sync: fakeSync,
    });

    it("returns 401 without Authorization header", async () => {
        const response = await routes.request("/api/sync", { method: "POST" });
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({
            error: "IMAP credentials are required",
        });
    });

    it("returns 200 with valid Basic credentials", async () => {
        fakeSync.mockResolvedValue({
            imported: 1,
            duplicates: 2,
            rejected: 3,
        });
        const encoded = Buffer.from("user@test.com:password").toString(
            "base64"
        );
        const response = await routes.request("/api/sync", {
            method: "POST",
            headers: { authorization: `Basic ${encoded}` },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            imported: 1,
            duplicates: 2,
            rejected: 3,
        });
    });

    it("maps ImapCredentialError to 401", async () => {
        fakeSync.mockRejectedValue(new ImapCredentialError("bad creds"));
        const encoded = Buffer.from("user@test.com:password").toString(
            "base64"
        );
        const response = await routes.request("/api/sync", {
            method: "POST",
            headers: { authorization: `Basic ${encoded}` },
        });
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({
            error: "IMAP credentials are invalid",
        });
    });

    it("maps ImapUnavailableError to 502", async () => {
        fakeSync.mockRejectedValue(new ImapUnavailableError("server down"));
        const encoded = Buffer.from("user@test.com:password").toString(
            "base64"
        );
        const response = await routes.request("/api/sync", {
            method: "POST",
            headers: { authorization: `Basic ${encoded}` },
        });
        expect(response.status).toBe(502);
        expect(await response.json()).toMatchObject({
            error: "IMAP server is unavailable",
        });
    });

    it("returns 401 for malformed credentials", async () => {
        const response = await routes.request("/api/sync", {
            method: "POST",
            headers: { authorization: "Basic !!!invalid" },
        });
        expect(response.status).toBe(401);
    });

    it("allows GET /api/mails without auth", async () => {
        const localRoutes = createRoutes({
            repository: new FakeRepository(),
            sync: fakeSync,
        });
        const response = await localRoutes.request("/api/mails");
        expect(response.status).toBe(200);
    });
});

describe("POST /api/compose — compose mail", () => {
    class ComposeRepository implements MailRepository {
        created: Omit<MailItem, "id"> | null = null;
        current: MailItem | null = null;

        create(item: Omit<MailItem, "id">): Promise<string> {
            this.created = item;
            this.current = { id: "sent-1", ...item };
            return Promise.resolve("sent-1");
        }

        get(_id: string): Promise<MailItem | null> {
            return Promise.resolve(this.current);
        }

        createIfAbsent(): Promise<{ id: string; created: boolean }> {
            return Promise.resolve({ id: "sent-1", created: true });
        }

        list(): Promise<MailItem[]> {
            return Promise.resolve(this.current ? [this.current] : []);
        }

        update(): Promise<void> {
            return Promise.resolve();
        }
    }

    it("returns 401 without Authorization header", async () => {
        const repository = new ComposeRepository();
        const routes = createRoutes({ repository });
        const response = await routes.request("/api/compose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to: ["user@example.invalid"],
                subject: "Test",
                body: "Hello",
            }),
        });
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({
            error: "IMAP credentials are required",
        });
    });

    it("returns 201 with valid auth and body", async () => {
        const repository = new ComposeRepository();
        const routes = createRoutes({ repository });
        const encoded = Buffer.from("user@kangnam.ac.kr:password").toString(
            "base64"
        );
        const response = await routes.request("/api/compose", {
            method: "POST",
            headers: {
                authorization: `Basic ${encoded}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: ["student@example.invalid"],
                cc: ["cc@example.invalid"],
                bcc: ["bcc@example.invalid"],
                subject: "Promotion subject",
                body: "Promotion body content",
            }),
        });
        expect(response.status).toBe(201);
        const body = MailApiItemSchema.parse(await response.json());
        expect(body.status).toBe("sent");
        expect(body.senderAddress).toBe("user@kangnam.ac.kr");
        expect(body.subject).toBe("Promotion subject");
        expect(body.textBody).toBe("Promotion body content");
        expect(body.recipients).toEqual(["student@example.invalid"]);
        expect(body.cc).toEqual(["cc@example.invalid"]);
        expect(body.bcc).toEqual(["bcc@example.invalid"]);
    });

    it("returns 400 for missing required fields", async () => {
        const repository = new ComposeRepository();
        const routes = createRoutes({ repository });
        const encoded = Buffer.from("user@kangnam.ac.kr:password").toString(
            "base64"
        );
        const response = await routes.request("/api/compose", {
            method: "POST",
            headers: {
                authorization: `Basic ${encoded}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        expect(response.status).toBe(400);
    });

    it("returns 400 for invalid JSON body", async () => {
        const repository = new ComposeRepository();
        const routes = createRoutes({ repository });
        const encoded = Buffer.from("user@kangnam.ac.kr:password").toString(
            "base64"
        );
        const response = await routes.request("/api/compose", {
            method: "POST",
            headers: {
                authorization: `Basic ${encoded}`,
                "Content-Type": "application/json",
            },
            body: "not json",
        });
        expect(response.status).toBe(400);
    });

    it("returns 201 without optional cc/bcc fields", async () => {
        const repository = new ComposeRepository();
        const routes = createRoutes({ repository });
        const encoded = Buffer.from("user@kangnam.ac.kr:password").toString(
            "base64"
        );
        const response = await routes.request("/api/compose", {
            method: "POST",
            headers: {
                authorization: `Basic ${encoded}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: ["student@example.invalid"],
                subject: "Minimal",
                body: "No cc/bcc",
            }),
        });
        expect(response.status).toBe(201);
        const body = MailApiItemSchema.parse(await response.json());
        expect(body.recipients).toEqual(["student@example.invalid"]);
        expect(body.cc).toEqual([]);
        expect(body.bcc).toEqual([]);
    });
});

describe("POST /api/mails/:id/flag — flag mail as important", () => {
    it("toggles isImportant on a mail item", async () => {
        const repository = new FakeRepository();
        const routes = createRoutes({ repository });

        const response = await routes.request("/api/mails/mail-1/flag", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ important: true }),
        });
        expect(response.status).toBe(200);
        const body = MailApiItemSchema.parse(await response.json());
        expect(body.isImportant).toBe(true);

        // Toggle back
        const toggled = await routes.request("/api/mails/mail-1/flag", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ important: false }),
        });
        expect(toggled.status).toBe(200);
        const toggledBody = MailApiItemSchema.parse(await toggled.json());
        expect(toggledBody.isImportant).toBe(false);
    });

    it("returns 404 for unknown mail", async () => {
        const repository = new FakeRepository();
        repository.get = () => Promise.resolve(null);
        const routes = createRoutes({ repository });

        const response = await routes.request("/api/mails/unknown/flag", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ important: true }),
        });
        expect(response.status).toBe(404);
    });

    it("returns 400 for missing important flag", async () => {
        const repository = new FakeRepository();
        const routes = createRoutes({ repository });

        const response = await routes.request("/api/mails/mail-1/flag", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(response.status).toBe(400);
    });
});

describe("POST /api/mails/:id/retry-analysis", () => {
    let criteriaRepository: FakeCriteriaRepository;

    beforeEach(() => {
        criteriaRepository = new FakeCriteriaRepository();
    });

    it("returns 500 for unknown mail (processMailItem throws)", async () => {
        const repository = new FakeRepository();
        repository.get = () => Promise.resolve(null);
        const routes = createRoutes({
            repository,
            criteriaRepository,
            analyzer: () => Promise.resolve(analysis),
        });
        const response = await routes.request(
            "/api/mails/unknown/retry-analysis",
            {
                method: "POST",
                headers: {
                    authorization: `Basic ${Buffer.from("test@example.com:pass").toString("base64")}`,
                },
            }
        );
        expect(response.status).toBe(500);
    });

    it("retries analysis on a failed mail", async () => {
        const repository = new FakeRepository(sampleItem("failed"));
        const routes = createRoutes({
            repository,
            criteriaRepository,
            analyzer: () => Promise.resolve(analysis),
        });
        const response = await routes.request(
            "/api/mails/mail-1/retry-analysis",
            {
                method: "POST",
                headers: {
                    authorization: `Basic ${Buffer.from("test@example.com:pass").toString("base64")}`,
                },
            }
        );
        expect(response.status).toBe(200);
        expect(JSON.parse(await response.text())).toHaveProperty(
            "status",
            "ready"
        );
    });
});
