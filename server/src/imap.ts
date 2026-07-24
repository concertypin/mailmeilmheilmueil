import {
    ImapFlow,
    type FetchMessageObject,
    type ImapFlowOptions,
} from "imapflow";
import { Timestamp } from "firebase-admin/firestore";
import { analyzeMail } from "./analysis";
import { parseMailSource } from "./mail-parser";
import { processMailItem, type MailAnalyzer } from "./processor";
import { firestoreRepository, type MailRepository } from "./repository";

export type ImapCredentials = {
    account: string;
    password: string;
};

export type ImapSyncResult = {
    imported: number;
    duplicates: number;
    rejected: number;
};

export class ImapCredentialError extends Error {
    readonly code = "IMAP_CREDENTIALS_INVALID";
}

export class ImapUnavailableError extends Error {
    readonly code = "IMAP_UNAVAILABLE";
}
export class ImapConfigurationError extends Error {
    readonly code = "IMAP_CONFIGURATION_INVALID";
}

export type ImapEnvironment = {
    IMAP_HOST?: string;
    IMAP_PORT?: string;
    IMAP_SECURE?: string;
};

export type ImapClient = {
    connect(): Promise<void>;
    logout(): Promise<void>;
    close(): void;
    on(event: "error", listener: (error: Error) => void): ImapClient;
    mailbox: { uidValidity: bigint } | false;
    getMailboxLock(
        path: string,
        options: { readOnly: boolean; acquireTimeout: number }
    ): Promise<{ release(): void }>;
    search(
        query: { seen: boolean },
        options: { uid: boolean }
    ): Promise<number[] | false>;
    fetchOne(
        uid: number,
        query: { uid: boolean; source: boolean; internalDate: boolean },
        options: { uid: boolean }
    ): Promise<FetchMessageObject | false>;
    messageFlagsAdd(
        range: number,
        flags: string[],
        options: { uid: boolean }
    ): Promise<boolean>;
};

export type ImapClientFactory = (credentials: ImapCredentials) => ImapClient;

function requiredImapValue(
    environment: ImapEnvironment,
    key: "IMAP_HOST"
): string {
    const value = environment[key]?.trim();
    if (!value) {
        throw new ImapConfigurationError(`${key} is required`);
    }
    return value;
}

function imapPort(environment: ImapEnvironment): number {
    const value = environment.IMAP_PORT?.trim() || "993";
    if (!/^\d+$/.test(value)) {
        throw new ImapConfigurationError("IMAP_PORT is invalid");
    }
    const port = Number(value);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
        throw new ImapConfigurationError("IMAP_PORT is invalid");
    }
    return port;
}

function imapSecure(environment: ImapEnvironment): boolean {
    const value = environment.IMAP_SECURE?.trim();
    if (!value || value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    throw new ImapConfigurationError("IMAP_SECURE is invalid");
}

export function imapOptionsFromEnv(
    environment: ImapEnvironment = process.env
): Pick<ImapFlowOptions, "host" | "port" | "secure"> {
    return {
        host: requiredImapValue(environment, "IMAP_HOST"),
        port: imapPort(environment),
        secure: imapSecure(environment),
    };
}

export function createImapClient(credentials: ImapCredentials): ImapClient {
    const options: ImapFlowOptions = {
        ...imapOptionsFromEnv(),
        auth: { user: credentials.account, pass: credentials.password },
    };
    const client = new ImapFlow(options);
    client.on("error", () => undefined);
    return client;
}

export function isAuthenticationFailure(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "authenticationFailed" in error &&
        error.authenticationFailed === true
    );
}

async function closeClient(client: ImapClient): Promise<void> {
    try {
        await client.logout();
    } catch {
        client.close();
    }
}

function validInternalDate(
    value: FetchMessageObject["internalDate"]
): Date | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    return undefined;
}

export async function syncInbox(
    credentials: ImapCredentials,
    repository: MailRepository = firestoreRepository,
    analyzer: MailAnalyzer = analyzeMail,
    clientFactory: ImapClientFactory = createImapClient
): Promise<ImapSyncResult> {
    const client = clientFactory(credentials);
    let lock: Awaited<ReturnType<ImapClient["getMailboxLock"]>> | undefined;
    try {
        try {
            await client.connect();
        } catch (error: unknown) {
            if (isAuthenticationFailure(error)) {
                throw new ImapCredentialError("IMAP authentication failed");
            }
            throw new ImapUnavailableError("IMAP server is unavailable");
        }
        lock = await client.getMailboxLock("INBOX", {
            readOnly: false,
            acquireTimeout: 30000,
        });
        if (!client.mailbox) {
            throw new ImapUnavailableError("IMAP server is unavailable");
        }
        const uidValidity = client.mailbox.uidValidity.toString();
        const searchResult = await client.search(
            { seen: false },
            { uid: true }
        );
        const uids = searchResult === false ? [] : searchResult;
        const result: ImapSyncResult = {
            imported: 0,
            duplicates: 0,
            rejected: 0,
        };

        for (const uid of uids) {
            const message = await client.fetchOne(
                uid,
                { uid: true, source: true, internalDate: true },
                { uid: true }
            );
            if (message === false || !message.source) {
                result.rejected += 1;
                await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
                continue;
            }

            let item: Awaited<ReturnType<typeof parseMailSource>>;
            try {
                const date = validInternalDate(message.internalDate);
                item = await parseMailSource(
                    message.source,
                    date ? Timestamp.fromDate(date) : Timestamp.now()
                );
            } catch {
                result.rejected += 1;
                await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
                continue;
            }

            const idempotencyKey = `${credentials.account}|${uidValidity}|${uid}`;
            const inserted = await repository.createIfAbsent(
                item,
                idempotencyKey
            );
            if (inserted.created) {
                result.imported += 1;
                const processingResult = await processMailItem(
                    inserted.id,
                    repository,
                    analyzer
                );
                if (processingResult === "failed") {
                    throw new ImapUnavailableError(
                        "Mail analysis failed; retry required"
                    );
                }
            } else {
                result.duplicates += 1;
                const existing = await repository.get(inserted.id);
                if (existing?.status === "failed") {
                    const processingResult = await processMailItem(
                        inserted.id,
                        repository,
                        analyzer
                    );
                    if (processingResult === "failed") {
                        throw new ImapUnavailableError(
                            "Mail analysis failed; retry required"
                        );
                    }
                }
            }
            await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        }
        return result;
    } catch (error: unknown) {
        if (error instanceof ImapCredentialError) {
            throw error;
        }
        if (error instanceof ImapUnavailableError) {
            throw error;
        }
        throw new ImapUnavailableError("IMAP server is unavailable");
    } finally {
        lock?.release();
        await closeClient(client);
    }
}
