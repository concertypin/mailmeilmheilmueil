import { z } from "zod";

interface ImapCredentials {
    account: string;
    password: string;
    host?: string;
    port?: number;
    secure?: boolean;
}

export const IMAP_BASIC_STORAGE_KEY = "mailmeilmheilmueil.imap-basic.v1";
const StoredCredentialsSchema = z.object({
    account: z.string().min(1),
    password: z.string().min(1),
    host: z.string().optional(),
    port: z.number().int().positive().max(65535).optional(),
    secure: z.boolean().optional(),
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

export function buildImapHeaders(
    credentials: ImapCredentials
): Record<string, string> {
    const headers: Record<string, string> = {
        authorization: encodeImapBasicAuthorization(
            credentials.account,
            credentials.password
        ),
    };
    if (credentials.host) headers["x-imap-host"] = credentials.host;
    if (credentials.port !== undefined)
        headers["x-imap-port"] = String(credentials.port);
    if (credentials.secure !== undefined)
        headers["x-imap-secure"] = String(credentials.secure);
    return headers;
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
        const d = result.data;
        return {
            account: d.account,
            password: d.password,
            ...(d.host ? { host: d.host } : {}),
            ...(d.port !== undefined ? { port: d.port } : {}),
            ...(d.secure !== undefined ? { secure: d.secure } : {}),
        };
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
