import { ImapFlow, type FetchMessageObject, type ImapFlowOptions } from "imapflow";
import { Timestamp } from "firebase-admin/firestore";
import { analyzeMail } from "./analysis";
import { parseMailSource } from "./smtp-receiver";
import { processMailItem, type MailAnalyzer } from "./processor";
import { firestoreRepository, type MailRepository } from "./repository";

export type ImapCredentials = {
    account: string;
    password: string;
};

export type ImapCredentialVerifier = (
    credentials: ImapCredentials
) => Promise<void>;

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
};
export type ImapClientFactory = (credentials: ImapCredentials) => ImapClient;

export function createImapClient(credentials: ImapCredentials): ImapClient {
    const options: ImapFlowOptions = {
        host: "mail.kangnam.ac.kr",
        port: 993,
        secure: true,
        auth: { user: credentials.account, pass: credentials.password },
    };
    const client = new ImapFlow(options);
    client.on("error", () => undefined);
    return client;
}

function isAuthenticationFailure(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        Reflect.get(error, "authenticationFailed") === true
    );
}

async function closeClient(client: ImapClient): Promise<void> {
    try {
        await client.logout();
    } catch {
        client.close();
    }
}

export async function verifyImapCredentials(
    credentials: ImapCredentials
): Promise<void> {
    const client = createImapClient(credentials);
    try {
        await client.connect();
    } catch (error: unknown) {
        if (isAuthenticationFailure(error)) {
            throw new ImapCredentialError("IMAP authentication failed");
        }
        throw new ImapUnavailableError("IMAP server is unavailable");
    } finally {
        await closeClient(client);
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
            readOnly: true,
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
            let message: FetchMessageObject | false;
            try {
                message = await client.fetchOne(
                    uid,
                    { uid: true, source: true, internalDate: true },
                    { uid: true }
                );
                if (message === false || !message.source) {
                    result.rejected += 1;
                    continue;
                }
                const date = validInternalDate(message.internalDate);
                const item = await parseMailSource(
                    message.source,
                    date ? Timestamp.fromDate(date) : Timestamp.now()
                );
                const idempotencyKey = `${credentials.account}|${uidValidity}|${message.uid}`;
                const inserted = await repository.createIfAbsent(
                    item,
                    idempotencyKey
                );
                if (inserted.created) {
                    result.imported += 1;
                    void processMailItem(
                        inserted.id,
                        repository,
                        analyzer
                    ).catch((error: unknown) => {
                        process.stderr.write(
                            `Mail processing failed: ${String(error)}\n`
                        );
                    });
                } else {
                    result.duplicates += 1;
                }
            } catch (error: unknown) {
                if (
                    error instanceof ImapCredentialError ||
                    error instanceof ImapUnavailableError
                ) {
                    throw error;
                }
                result.rejected += 1;
            }
        }
        return result;
    } catch (error: unknown) {
        if (
            error instanceof ImapCredentialError ||
            error instanceof ImapUnavailableError
        ) {
            throw error;
        }
        throw new ImapUnavailableError("IMAP server is unavailable");
    } finally {
        lock?.release();
        await closeClient(client);
    }
}
