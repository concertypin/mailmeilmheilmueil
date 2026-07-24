import { type DocumentData } from "firebase-admin/firestore";
import { db } from "./firebase";
import {
    AnalysisCriteriaSchema,
    type AnalysisCriteria,
} from "../../src/lib/mail-schema";

export interface AnalysisCriteriaRepository {
    get(account: string): Promise<AnalysisCriteria>;
    save(
        account: string,
        criteria: AnalysisCriteria
    ): Promise<AnalysisCriteria>;
}

function parseCriteriaDocument(
    account: string,
    data: DocumentData | undefined
): AnalysisCriteria {
    if (!data) {
        return { customFields: [] };
    }
    const result = AnalysisCriteriaSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    return { customFields: [] };
}

export const firestoreAnalysisCriteriaRepository: AnalysisCriteriaRepository = {
    async get(account: string): Promise<AnalysisCriteria> {
        const snapshot = await db
            .collection("analysisCriteria")
            .doc(account)
            .get();
        return parseCriteriaDocument(account, snapshot.data());
    },

    async save(
        account: string,
        criteria: AnalysisCriteria
    ): Promise<AnalysisCriteria> {
        const validated = AnalysisCriteriaSchema.parse(criteria);
        await db.collection("analysisCriteria").doc(account).set(validated);
        return validated;
    },
};
export type { AnalysisCriteria };
