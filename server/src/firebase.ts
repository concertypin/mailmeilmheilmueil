import {
    cert,
    getApp,
    getApps,
    initializeApp,
    type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";

const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-mailmeilmheilmueil";
const serviceAccountSchema = z
    .object({
        project_id: z.string().optional(),
        client_email: z.string().optional(),
        private_key: z.string().optional(),
        projectId: z.string().optional(),
        clientEmail: z.string().optional(),
        privateKey: z.string().optional(),
    })
    .transform((value, context) => {
        const serviceAccountProjectId = value.projectId ?? value.project_id;
        const clientEmail = value.clientEmail ?? value.client_email;
        const privateKey = value.privateKey ?? value.private_key;
        if (!serviceAccountProjectId || !clientEmail || !privateKey) {
            context.addIssue({
                code: "custom",
                message: "Missing Firebase service-account fields",
            });
            return z.NEVER;
        }
        return {
            projectId: serviceAccountProjectId,
            clientEmail,
            privateKey,
        };
    });

export function firebaseCredentialFromEnv(
    value = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
): ServiceAccount | undefined {
    if (!value?.trim()) return undefined;
    try {
        const result = serviceAccountSchema.safeParse(JSON.parse(value));
        if (!result.success) throw new Error("Invalid service account");
        return result.data;
    } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON");
    }
}

const serviceAccount = firebaseCredentialFromEnv();
const app = getApps().length
    ? getApp()
    : serviceAccount
      ? initializeApp({ projectId, credential: cert(serviceAccount) })
      : initializeApp({ projectId });

export const db = getFirestore(app);
