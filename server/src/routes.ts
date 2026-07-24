import { z } from "zod";
import { Hono } from "hono";
import {
    convertToModelMessages,
    createUIMessageStreamResponse,
    streamText,
    toUIMessageStream,
    tool,
} from "ai";
import { Timestamp } from "firebase-admin/firestore";
import {
    AnalysisCriteriaSchema,
    ComposeRequestSchema,
    FlagMailRequestSchema,
    resolveAnalysisFields,
    ReviewMailRequestSchema,
    toMailApiItem,
} from "../../src/lib/mail-schema";
import { firestoreRepository, type MailRepository } from "./repository";
import {
    firestoreAnalysisCriteriaRepository,
    type AnalysisCriteriaRepository,
} from "./criteria";
import { analyzeMail, collabModelConfig, pickModel } from "./analysis";
import { processMailItem, type MailAnalyzer } from "./processor";
import { parseImapCredentialsFromRequest } from "./basic-auth";
import {
    createImapClient,
    isAuthenticationFailure,
    ImapConfigurationError,
    ImapCredentialError,
    ImapUnavailableError,
    syncInbox,
    type ImapCredentials,
    type ImapSyncResult,
    type SyncInboxOptions,
} from "./imap";

export type SyncFn = (
    credentials: ImapCredentials,
    repository: MailRepository,
    options?: SyncInboxOptions
) => Promise<ImapSyncResult>;

export type TestCredentialsFn = (credentials: ImapCredentials) => Promise<void>;

export type RouteDependencies = {
    repository?: MailRepository;
    criteriaRepository?: AnalysisCriteriaRepository;
    sync?: SyncFn;
    testCredentials?: TestCredentialsFn;
    analyzer?: MailAnalyzer;
};

async function defaultTestCredentials(
    credentials: ImapCredentials
): Promise<void> {
    const client = createImapClient(credentials);
    try {
        await client.connect();
    } finally {
        await client.logout();
    }
}
export function createRoutes(dependencies: RouteDependencies = {}) {
    const repository = dependencies.repository ?? firestoreRepository;
    const criteriaRepository =
        dependencies.criteriaRepository ?? firestoreAnalysisCriteriaRepository;
    return new Hono()
        .get("/healthz", (context) => context.json({ status: "ok" }))
        .post("/api/login", async (context) => {
            const credentials = parseImapCredentialsFromRequest(
                context.req.header("authorization"),
                {
                    "x-imap-host": context.req.header("x-imap-host"),
                    "x-imap-port": context.req.header("x-imap-port"),
                    "x-imap-secure": context.req.header("x-imap-secure"),
                }
            );
            if (!credentials) {
                return context.json(
                    { error: "IMAP credentials are required" },
                    401,
                    { "WWW-Authenticate": 'Basic realm="IMAP"' }
                );
            }
            try {
                const test =
                    dependencies.testCredentials ?? defaultTestCredentials;
                await test(credentials);
                return context.body(null, 204);
            } catch (error: unknown) {
                if (error instanceof ImapConfigurationError) {
                    return context.json(
                        { error: "IMAP server is not configured" },
                        500
                    );
                }
                if (isAuthenticationFailure(error)) {
                    return context.json(
                        { error: "IMAP credentials are invalid" },
                        401,
                        { "WWW-Authenticate": 'Basic realm="IMAP"' }
                    );
                }
                return context.json(
                    { error: "IMAP server is unavailable" },
                    502
                );
            }
        })
        .post("/api/login/test", async (context) => {
            const testAccount = testAccountFromEnv();
            if (!testAccount) {
                return context.json(
                    { error: "Test account is not configured" },
                    404
                );
            }
            try {
                const test =
                    dependencies.testCredentials ?? defaultTestCredentials;
                await test(testAccount);
                return context.json(testAccount);
            } catch {
                return context.json(
                    { error: "Test account credentials are invalid" },
                    502
                );
            }
        })
        .get("/api/analysis-criteria", async (context) => {
            const credentials = parseImapCredentialsFromRequest(
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
                const criteria = await criteriaRepository.get(
                    credentials.account
                );
                return context.json(criteria);
            } catch {
                return context.json(
                    { error: "Failed to load analysis criteria" },
                    500
                );
            }
        })
        .put("/api/analysis-criteria", async (context) => {
            const credentials = parseImapCredentialsFromRequest(
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
                return context.json(
                    { error: "Invalid analysis criteria" },
                    400
                );
            }
            const parsed = AnalysisCriteriaSchema.safeParse(body);
            if (!parsed.success) {
                return context.json(
                    { error: "Invalid analysis criteria" },
                    400
                );
            }
            try {
                const saved = await criteriaRepository.save(
                    credentials.account,
                    parsed.data
                );
                return context.json(saved);
            } catch {
                return context.json(
                    { error: "Failed to save analysis criteria" },
                    500
                );
            }
        })
        .post("/api/sync", async (context) => {
            const credentials = parseImapCredentialsFromRequest(
                context.req.header("authorization"),
                {
                    "x-imap-host":
                        context.req.header("x-imap-host") ?? undefined,
                    "x-imap-port":
                        context.req.header("x-imap-port") ?? undefined,
                    "x-imap-secure":
                        context.req.header("x-imap-secure") ?? undefined,
                }
            );
            if (!credentials) {
                return context.json(
                    { error: "IMAP credentials are required" },
                    401,
                    { "WWW-Authenticate": 'Basic realm="IMAP"' }
                );
            }
            try {
                const criteria = await criteriaRepository.get(
                    credentials.account
                );
                const fields = resolveAnalysisFields(criteria);
                const sync = dependencies.sync ?? syncInbox;
                const result = await sync(credentials, repository, { fields });
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
            const credentials = parseImapCredentialsFromRequest(
                context.req.header("authorization")
            );
            const items = await repository.list(credentials?.account);
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
                draft: parsed.data.promotionDraft,
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
            const credentials = parseImapCredentialsFromRequest(
                context.req.header("authorization"),
                {
                    "x-imap-host":
                        context.req.header("x-imap-host") ?? undefined,
                    "x-imap-port":
                        context.req.header("x-imap-port") ?? undefined,
                    "x-imap-secure":
                        context.req.header("x-imap-secure") ?? undefined,
                }
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
                    mailboxAccount: credentials.account,
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
                    draft: null,
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
        })

        .post("/api/mails/:id/retry-analysis", async (context) => {
            const id = context.req.param("id");
            const credentials = parseImapCredentialsFromRequest(
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
                const criteria = await criteriaRepository.get(
                    credentials.account
                );
                const fields = resolveAnalysisFields(criteria);
                const analyzer: MailAnalyzer =
                    dependencies.analyzer ?? analyzeMail;
                const result = await processMailItem(id, repository, {
                    fields,
                    analyzer,
                });
                const item = await repository.get(id);
                if (!item) {
                    return context.json({ error: "Mail not found" }, 404);
                }
                return context.json(
                    { status: result, mail: toMailApiItem(item) },
                    result === "ready" ? 200 : 500
                );
            } catch (error: unknown) {
                return context.json(
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : "Analysis failed",
                    },
                    500
                );
            }
        })
        .post("/api/mails/:id/collab", async (context) => {
            const id = context.req.param("id");
            const body: { messages?: unknown; draft?: unknown } =
                await context.req.json();
            if (
                !body.messages ||
                !Array.isArray(body.messages) ||
                body.messages.length === 0
            ) {
                return context.json(
                    { error: "messages array is required" },
                    400
                );
            }
            let currentDraft: string | undefined =
                typeof body.draft === "string" ? body.draft : undefined;
            if (currentDraft === undefined) {
                try {
                    const item = await repository.get(id);
                    if (item) {
                        currentDraft = item.draft ?? undefined;
                    }
                } catch {
                    /* draft fetch is best-effort */
                }
            }
            const model = pickModel(collabModelConfig());
            const result = streamText({
                model,
                // oxlint-disable-next-line typescript/no-unsafe-argument
                messages: await convertToModelMessages(body.messages),
                instructions: `You assist a university staff member in refining a promotional draft in Korean.
The user provides a request. To update the draft, use the \`patchDraft\` tool.
Always call \`patchDraft\` when the user asks to change the draft.
Keep the tone warm and professional, suitable for a Korean university announcement.

Current draft:
${currentDraft ?? "아직 생성된 초안이 없습니다. 분석 결과를 바탕으로 초안을 먼저 생성해 주세요."}`,
                tools: {
                    patchDraft: tool({
                        description:
                            "Update the promotional draft with the revised version based on the user's request.",
                        inputSchema: z.object({
                            draft: z
                                .string()
                                .describe(
                                    "The complete revised promotional draft text"
                                ),
                        }),
                    }),
                },
            });
            return createUIMessageStreamResponse({
                stream: toUIMessageStream({
                    stream: result.stream,
                }),
            });
        });
}

export const testAccountFromEnv = () => {
    const account = process.env.TEST_IMAP_ACCOUNT?.trim();
    const password = process.env.TEST_IMAP_PASSWORD;
    if (!account || !password) return undefined;
    const host = process.env.TEST_IMAP_HOST?.trim();
    const portStr = process.env.TEST_IMAP_PORT?.trim();
    const secureStr = process.env.TEST_IMAP_SECURE?.trim();
    const result: ImapCredentials = {
        account,
        password,
    };
    if (host) result.host = host;
    if (portStr) {
        const port = Number(portStr);
        if (Number.isSafeInteger(port) && port > 0 && port <= 65535) {
            result.port = port;
        }
    }
    if (secureStr === "false") {
        result.secure = false;
    } else if (secureStr === "true" || !secureStr) {
        result.secure = true;
    }
    return result;
};
