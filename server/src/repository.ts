import { createHash } from "node:crypto";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { db } from "./firebase";
import {
    MailItemSchema,
    type MailItem,
    type MailStatus,
} from "../../src/lib/mail-schema";

export type MailUpdate = Partial<
    Pick<
        MailItem,
        | "mailboxAccount"
        | "status"
        | "processedAt"
        | "reviewedAt"
        | "failureMessage"
        | "analysis"
        | "isImportant"
        | "draft"
        | "images"
    >
>;
export interface MailRepository {
    create(item: Omit<MailItem, "id">): Promise<string>;
    createIfAbsent(
        item: Omit<MailItem, "id">,
        idempotencyKey: string
    ): Promise<{ id: string; created: boolean }>;
    get(id: string): Promise<MailItem | null>;
    list(mailboxAccount?: string): Promise<MailItem[]>;
    update(id: string, update: MailUpdate): Promise<void>;
}

function parseMailItem(id: string, data: DocumentData): MailItem {
    return MailItemSchema.parse({ id, ...data });
}

function isAlreadyExistsError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    return (
        Reflect.get(error, "code") === 6 ||
        Reflect.get(error, "code") === "6" ||
        Reflect.get(error, "code") === "already-exists" ||
        Reflect.get(error, "code") === "ALREADY_EXISTS"
    );
}
function stripUndefined<T extends Record<string, unknown>>(
    obj: T
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    return result;
}

export const firestoreRepository: MailRepository = {
    async create(item) {
        const ref = await db.collection("mailItems").add(stripUndefined(item));
        return ref.id;
    },
    async createIfAbsent(item, idempotencyKey) {
        const id = createHash("sha256").update(idempotencyKey).digest("hex");
        const ref = db.collection("mailItems").doc(id);
        try {
            await ref.create(stripUndefined(item));
            return { id, created: true };
        } catch (error) {
            if (isAlreadyExistsError(error)) {
                return { id, created: false };
            }
            throw error;
        }
    },
    async get(id) {
        const snapshot = await db.collection("mailItems").doc(id).get();
        return snapshot.exists
            ? parseMailItem(snapshot.id, snapshot.data() ?? {})
            : null;
    },
    async update(id, update) {
        await db.collection("mailItems").doc(id).update(stripUndefined(update));
    },
    async list(mailboxAccount) {
        const snapshot = await db
            .collection("mailItems")
            .orderBy("receivedAt", "desc")
            .get();
        const items = snapshot.docs.map((doc) =>
            parseMailItem(doc.id, doc.data())
        );
        return mailboxAccount
            ? items.filter((item) => item.mailboxAccount === mailboxAccount)
            : items;
    },
};

export function queuedMail(item: Omit<MailItem, "id">): Omit<MailItem, "id"> {
    return {
        ...item,
        status: "queued" satisfies MailStatus,
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: null,
    };
}

export function now(): Timestamp {
    return Timestamp.now();
}
