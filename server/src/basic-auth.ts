import type { ImapCredentials } from "./imap";

/**
 * Parse an HTTP `Authorization: Basic <base64>` header into IMAP credentials.
 * Returns null when the header is missing, has the wrong scheme, contains
 * malformed base64, or has a blank account or password.
 */
export function parseImapBasicAuthorization(
    authorization: string | undefined
): ImapCredentials | null {
    if (!authorization) return null;

    const parts = authorization.split(/\s+/);
    const scheme = parts[0];
    if (parts.length !== 2 || !scheme || scheme.toLowerCase() !== "basic")
        return null;

    const encoded = parts[1];
    if (!encoded) return null;

    // Strict base64 validation: reject non-alphabet characters and invalid padding
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
    if (encoded.length % 4 !== 0) return null;

    let decoded: string;
    try {
        decoded = Buffer.from(encoded, "base64").toString("utf-8");
    } catch {
        return null;
    }

    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) return null;

    const account = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    if (account.length === 0 || password.length === 0) return null;

    return { account, password };
}

export function parseImapCredentialsFromRequest(
    authorization: string | undefined,
    headers?: Record<string, string | undefined>
): ImapCredentials | null {
    const base = parseImapBasicAuthorization(authorization);
    if (!base) return null;
    if (!headers) return base;
    const host = headers["x-imap-host"]?.trim();
    const portStr = headers["x-imap-port"]?.trim();
    const secureStr = headers["x-imap-secure"]?.trim();
    const result: ImapCredentials = { ...base };
    if (host) result.host = host;
    if (portStr) {
        const port = Number(portStr);
        if (Number.isSafeInteger(port) && port > 0 && port <= 65535) {
            result.port = port;
        }
    }
    if (secureStr === "true") result.secure = true;
    else if (secureStr === "false") result.secure = false;
    return result;
}
