import { z } from "zod";

interface ImapCredentials {
    account: string;
    password: string;
}

export const IMAP_BASIC_STORAGE_KEY = "mailmeilmheilmueil.imap-basic.v1";

const StoredCredentialsSchema = z.object({
    account: z.string().min(1),
    password: z.string().min(1),
});

function utf8ToBase64(input: string): string {
    const bytes = new TextEncoder().encode(input);
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
}

export function encodeImapBasicAuthorization(
    account: string,
    password: string
): string {
    const encoded = utf8ToBase64(`${account}:${password}`);
    return `Basic ${encoded}`;
}

export function loadImapBasicCredentials(
    storage: Storage = window.sessionStorage
): ImapCredentials | null {
    try {
        const raw = storage.getItem(IMAP_BASIC_STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        const result = StoredCredentialsSchema.safeParse(parsed);
        if (!result.success) {
            storage.removeItem(IMAP_BASIC_STORAGE_KEY);
            return null;
        }
        return result.data;
    } catch {
        try {
            storage.removeItem(IMAP_BASIC_STORAGE_KEY);
        } catch {
            // Storage may be unavailable
        }
        return null;
    }
}

export function saveImapBasicCredentials(
    credentials: ImapCredentials,
    storage: Storage = window.sessionStorage
): void {
    storage.setItem(IMAP_BASIC_STORAGE_KEY, JSON.stringify(credentials));
}

export function clearImapBasicCredentials(
    storage: Storage = window.sessionStorage
): void {
    try {
        storage.removeItem(IMAP_BASIC_STORAGE_KEY);
    } catch {
        // Storage may be unavailable
    }
}
