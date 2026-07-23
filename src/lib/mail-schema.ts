import { z } from "zod";

export const mailStatuses = [
    "queued",
    "processing",
    "ready",
    "failed",
    "reviewed",
    "sent",
] as const;

export const mailCategories = [
    "채용",
    "직업훈련",
    "대외활동",
    "외부 프로그램",
    "기타",
] as const;

export type MailStatus = (typeof mailStatuses)[number];

export interface FirestoreTimestamp {
    toDate(): Date;
    toMillis(): number;
}

const timestampSchema = z.custom<FirestoreTimestamp>(
    (value) =>
        Boolean(
            value &&
            typeof value === "object" &&
            "toDate" in value &&
            "toMillis" in value
        ),
    "Expected a Firestore timestamp"
);

const nullableText = z.string().nullable();

export const MailAnalysisSchema = z.object({
    category: z.enum(mailCategories),
    audience: nullableText,
    schedule: nullableText,
    applicationDeadline: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date")
        .nullable(),
    benefits: nullableText,
    applicationMethod: nullableText,
    contactOrReference: nullableText,
    reviewNotes: z.array(z.string()),
    promotionDraft: z.string().min(1),
});

export type MailAnalysis = z.infer<typeof MailAnalysisSchema>;

export const MailItemSchema = z.object({
    id: z.string(),
    senderName: z.string(),
    senderAddress: z.string(),
    recipients: z.array(z.string()),
    cc: z.array(z.string()).optional(),
    bcc: z.array(z.string()).optional(),
    subject: z.string(),
    textBody: z.string(),
    receivedAt: timestampSchema,
    externalMessageId: z.string().nullable(),
    status: z.enum(mailStatuses),
    processedAt: timestampSchema.nullable(),
    reviewedAt: timestampSchema.nullable(),
    failureMessage: z.string().nullable(),
    analysis: MailAnalysisSchema.nullable(),
});

export type MailItem = z.infer<typeof MailItemSchema>;

const mailApiTimestampSchema = z.iso.datetime({ offset: true });

export const MailApiItemSchema = MailItemSchema.extend({
    receivedAt: mailApiTimestampSchema,
    processedAt: mailApiTimestampSchema.nullable(),
    reviewedAt: mailApiTimestampSchema.nullable(),
});

export type MailApiItem = z.infer<typeof MailApiItemSchema>;

function timestampFromDate(date: Date): FirestoreTimestamp {
    return {
        toDate: () => date,
        toMillis: () => date.getTime(),
    };
}

export function toMailApiItem(item: MailItem): MailApiItem {
    return MailApiItemSchema.parse({
        ...item,
        receivedAt: item.receivedAt.toDate().toISOString(),
        processedAt: item.processedAt?.toDate().toISOString() ?? null,
        reviewedAt: item.reviewedAt?.toDate().toISOString() ?? null,
    });
}

export function fromMailApiItem(item: MailApiItem): MailItem {
    const parsed = MailApiItemSchema.parse(item);
    return MailItemSchema.parse({
        ...parsed,
        receivedAt: timestampFromDate(new Date(parsed.receivedAt)),
        processedAt: parsed.processedAt
            ? timestampFromDate(new Date(parsed.processedAt))
            : null,
        reviewedAt: parsed.reviewedAt
            ? timestampFromDate(new Date(parsed.reviewedAt))
            : null,
    });
}

export const ReviewMailRequestSchema = z.object({
    promotionDraft: z.string().trim().min(1),
});

export const ComposeRequestSchema = z.object({
    to: z
        .array(z.string().trim().min(1))
        .min(1, "At least one recipient is required"),
    cc: z.array(z.string().trim().min(1)).optional(),
    bcc: z.array(z.string().trim().min(1)).optional(),
    subject: z.string().trim().min(1, "Subject is required"),
    body: z.string().trim().min(1, "Body is required"),
});

export type ComposeRequest = z.infer<typeof ComposeRequestSchema>;
