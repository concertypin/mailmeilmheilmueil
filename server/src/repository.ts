import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { db } from "./firebase";
import { MailItemSchema, type MailItem, type MailStatus } from "../../src/lib/mail-schema";

export type MailUpdate = Partial<Pick<MailItem, "status" | "processedAt" | "reviewedAt" | "failureMessage" | "analysis">>;

export interface MailRepository {
    create(item: Omit<MailItem, "id">): Promise<string>;
    get(id: string): Promise<MailItem | null>;
    update(id: string, update: MailUpdate): Promise<void>;
}

function parseMailItem(id: string, data: DocumentData): MailItem {
    return MailItemSchema.parse({ id, ...data });
}

export const firestoreRepository: MailRepository = {
    async create(item) {
        const ref = await db.collection("mailItems").add(item);
        return ref.id;
    },
    async get(id) {
        const snapshot = await db.collection("mailItems").doc(id).get();
        return snapshot.exists ? parseMailItem(snapshot.id, snapshot.data() ?? {}) : null;
    },
    async update(id, update) {
        await db.collection("mailItems").doc(id).update(update);
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
