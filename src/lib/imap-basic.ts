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
    storage?: Storage
): ImapCredentials | null {
    try {
        const target = storage ?? window.sessionStorage;
        const raw = target.getItem(IMAP_BASIC_STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        const result = StoredCredentialsSchema.safeParse(parsed);
        if (!result.success) {
            target.removeItem(IMAP_BASIC_STORAGE_KEY);
            return null;
        }
        return result.data;
    } catch {
        try {
            const target = storage ?? window.sessionStorage;
            target.removeItem(IMAP_BASIC_STORAGE_KEY);
        } catch {
            // Storage may be unavailable
        }
        return null;
    }
}

export function saveImapBasicCredentials(
    credentials: ImapCredentials,
    storage?: Storage
): void {
    try {
        const target = storage ?? window.sessionStorage;
        target.setItem(IMAP_BASIC_STORAGE_KEY, JSON.stringify(credentials));
    } catch {
        // Storage may be unavailable
    }
}

export function clearImapBasicCredentials(storage?: Storage): void {
    try {
        const target = storage ?? window.sessionStorage;
        target.removeItem(IMAP_BASIC_STORAGE_KEY);
    } catch {
        // Storage may be unavailable
    }
}

export const INVALID_IMAP_CREDENTIALS_MESSAGE =
    "IMAP 인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.";

export function redirectForInvalidImapCredentials(): void {
    clearImapBasicCredentials();
    window.location.assign("/?imapCredentialsInvalid=1");
}

export function throwIfUnauthorized(response: Response): void {
    if (response.status === 401) {
        redirectForInvalidImapCredentials();
        throw new Error(INVALID_IMAP_CREDENTIALS_MESSAGE);
    }
}
