import { randomUUID } from "node:crypto";
import {
    type ImapCredentialVerifier,
    type ImapCredentials,
    verifyImapCredentials,
} from "./imap";

const SESSION_TTL_MS = 30 * 60 * 1000;

type StoredSession = ImapCredentials & {
    expiresAt: number;
    expiryTimer?: ReturnType<typeof setTimeout>;
};

export type ImapSessionStore = {
    create(
        portalId: string,
        password: string
    ): Promise<{ token: string; account: string }>;
    get(token: string): ImapCredentials | null;
    delete(token: string): void;
};

const sessions = new Map<string, StoredSession>();
function scheduleExpiry(token: string, session: StoredSession): void {
    clearTimeout(session.expiryTimer);
    session.expiryTimer = setTimeout(() => {
        const current = sessions.get(token);
        if (current === session && Date.now() >= session.expiresAt) {
            sessions.delete(token);
        }
    }, SESSION_TTL_MS);
    session.expiryTimer.unref();
}

export async function createImapSession(
    portalId: string,
    password: string,
    verify: ImapCredentialVerifier = verifyImapCredentials
): Promise<{ token: string; account: string }> {
    const account = `${portalId}@kangnam.ac.kr`;
    await verify({ account, password });
    const token = randomUUID();
    const session: StoredSession = {
        account,
        password,
        expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(token, session);
    scheduleExpiry(token, session);
    return { token, account };
}

export function getImapSession(token: string): ImapCredentials | null {
    const session = sessions.get(token);
    if (!session) {
        return null;
    }
    if (Date.now() >= session.expiresAt) {
        deleteImapSession(token);
        return null;
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    scheduleExpiry(token, session);
    return { account: session.account, password: session.password };
}

export function deleteImapSession(token: string): void {
    const session = sessions.get(token);
    if (!session) {
        return;
    }
    clearTimeout(session.expiryTimer);
    sessions.delete(token);
}

export const imapSessions: ImapSessionStore = {
    create: createImapSession,
    get: getImapSession,
    delete: deleteImapSession,
};
