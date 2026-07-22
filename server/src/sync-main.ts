import { pathToFileURL } from "node:url";
import "dotenv/config";
import {
    ImapConfigurationError,
    ImapCredentialError,
    ImapUnavailableError,
    imapOptionsFromEnv,
    syncInbox,
    type ImapCredentials,
    type ImapEnvironment,
    type ImapSyncResult,
} from "./imap";

export type SyncEnvironment = ImapEnvironment & {
    IMAP_ACCOUNT?: string;
    IMAP_PASSWORD?: string;
};

type SyncRunner = (credentials: ImapCredentials) => Promise<ImapSyncResult>;

function requiredCredential(
    environment: SyncEnvironment,
    key: "IMAP_ACCOUNT" | "IMAP_PASSWORD"
): string {
    const value = environment[key];
    if (!value || (key === "IMAP_ACCOUNT" && !value.trim())) {
        throw new ImapConfigurationError(`${key} is required`);
    }
    return key === "IMAP_ACCOUNT" ? value.trim() : value;
}

export function credentialsFromEnv(
    environment: SyncEnvironment = process.env
): ImapCredentials {
    imapOptionsFromEnv(environment);
    return {
        account: requiredCredential(environment, "IMAP_ACCOUNT"),
        password: requiredCredential(environment, "IMAP_PASSWORD"),
    };
}

export async function runSync(
    environment: SyncEnvironment = process.env,
    runner: SyncRunner = syncInbox
): Promise<ImapSyncResult> {
    return runner(credentialsFromEnv(environment));
}
function safeFailure(error: unknown): string {
    if (error instanceof ImapConfigurationError) {
        return error.message;
    }
    if (error instanceof ImapCredentialError) {
        return "IMAP authentication failed";
    }
    if (error instanceof ImapUnavailableError) {
        return "IMAP server is unavailable";
    }
    return "IMAP sync failed";
}

export async function main(
    environment: SyncEnvironment = process.env,
    runner: SyncRunner = syncInbox
): Promise<number> {
    try {
        const result = await runSync(environment, runner);
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return 0;
    } catch (error: unknown) {
        process.stderr.write(`${safeFailure(error)}\n`);
        process.exitCode = 1;
        return 1;
    }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
    await main();
}
