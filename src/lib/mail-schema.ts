import * as z from "zod";

export const mailStatuses = [
    "queued",
    "processing",
    "ready",
    "failed",
    "reviewed",
    "sent",
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

// ── Analysis field / criteria contracts ──────────────────────────────

/** A single configurable analysis-extraction field that the AI model is instructed to produce. */
export const AnalysisFieldSchema = z.object({
    key: z
        .string()
        .regex(
            /^[a-z][A-Za-z0-9]{0,31}$/,
            "Key must start with a lowercase letter and contain only letters and digits"
        ),
    label: z
        .string()
        .min(1)
        .max(50)
        .transform((s) => s.trim()),
    instruction: z
        .string()
        .min(1)
        .max(500)
        .transform((s) => s.trim()),
    isCategory: z.boolean(),
});
export type AnalysisField = z.infer<typeof AnalysisFieldSchema>;

/** Immutable baseline fields that every account starts with. */
export const DEFAULT_ANALYSIS_FIELDS: readonly AnalysisField[] = [
    {
        key: "category",
        label: "분류",
        instruction:
            "Choose one category: 채용, 직업훈련, 대외활동, 외부 프로그램, 기타",
        isCategory: true,
    },
    {
        key: "audience",
        label: "대상",
        instruction: "Extract the target audience (null if absent)",
        isCategory: false,
    },
    {
        key: "schedule",
        label: "일정",
        instruction: "Extract schedule information (null if absent)",
        isCategory: false,
    },
    {
        key: "applicationDeadline",
        label: "신청 마감",
        instruction:
            "Normalize the application deadline to YYYY-MM-DD format (null if absent or unverifiable)",
        isCategory: false,
    },
    {
        key: "benefits",
        label: "혜택",
        instruction: "Extract benefits information (null if absent)",
        isCategory: false,
    },
    {
        key: "applicationMethod",
        label: "신청 방법",
        instruction: "Extract the application method (null if absent)",
        isCategory: false,
    },
    {
        key: "contactOrReference",
        label: "문의·참고",
        instruction:
            "Extract contact details or reference information (null if absent)",
        isCategory: false,
    },
];

/** Per-IMAP-account criteria: default fields the user has disabled plus custom fields. */
export const AnalysisCriteriaSchema = z
    .object({
        disabledDefaultKeys: z.array(z.string()).default([]),
        customFields: z.array(AnalysisFieldSchema).max(13),
    })
    .refine(
        (data) => {
            const defaultKeySet = new Set(
                DEFAULT_ANALYSIS_FIELDS.map((f) => f.key)
            );
            for (const key of data.disabledDefaultKeys) {
                if (!defaultKeySet.has(key)) return false;
            }
            const seen = new Set<string>();
            for (const field of data.customFields) {
                if (field.isCategory) return false;
                if (defaultKeySet.has(field.key)) return false;
                if (seen.has(field.key)) return false;
                seen.add(field.key);
            }
            return true;
        },
        {
            message:
                "Invalid disabled default keys, or custom fields must not duplicate default keys, must have unique keys, and no custom category field",
        }
    );
export type AnalysisCriteria = z.infer<typeof AnalysisCriteriaSchema>;

/** Resolve active fields: defaults minus disabled plus custom fields. */
export function resolveAnalysisFields(
    criteria: AnalysisCriteria
): AnalysisField[] {
    const disabledSet = new Set(criteria.disabledDefaultKeys ?? []);
    const defaults = DEFAULT_ANALYSIS_FIELDS.filter(
        (f) => !disabledSet.has(f.key)
    );
    return [...defaults, ...criteria.customFields];
}

/**
 * Build a strict Zod object for AI structured output containing exactly
 * the supplied field keys (each `string | null`) plus `reviewNotes`.
 */
export function createMailAnalysisOutputSchema(
    fields: readonly AnalysisField[]
) {
    const shape: Record<string, z.ZodType> = {
        reviewNotes: z.array(z.string()),
    };
    for (const field of fields) {
        shape[field.key] = z.string().nullable();
    }
    return z.object(shape);
}

// ── Stored analysis (generic record for backward compatibility) ──────

/**
 * Generic persisted analysis shape that accepts any flat key-value pairs
 * so existing Firestore documents (with baseline keys) remain readable.
 */
export const MailAnalysisSchema = z
    .object({
        reviewNotes: z.array(z.string()),
    })
    .loose();
export type MailAnalysis = z.infer<typeof MailAnalysisSchema>;

// ── Mail item ────────────────────────────────────────────────────────

export const MailItemSchema = z.object({
    id: z.string(),
    senderName: z.string(),
    senderAddress: z.string(),
    recipients: z.array(z.string()),
    cc: z.array(z.string()).optional(),
    bcc: z.array(z.string()).optional(),
    subject: z.string(),
    textBody: z.string(),
    htmlBody: z.string().optional(),
    receivedAt: timestampSchema,
    externalMessageId: z.string().nullable(),
    status: z.enum(mailStatuses),
    processedAt: timestampSchema.nullable(),
    reviewedAt: timestampSchema.nullable(),
    failureMessage: z.string().nullable(),
    analysis: MailAnalysisSchema.nullable(),
    draft: z.string().nullable().optional(),
    isImportant: z.boolean().optional(),
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

// ── Request schemas ──────────────────────────────────────────────────

export const ReviewMailRequestSchema = z.object({
    promotionDraft: z.string().trim().min(1),
});

export const ComposeRequestSchema = z
    .object({
        to: z.array(z.string()).optional(),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        subject: z.string(),
        body: z.string(),
    })
    .refine((data) => (data.to ?? []).length + (data.bcc ?? []).length > 0, {
        message: "At least one recipient (to or bcc) is required",
    });

export type ComposeRequest = z.infer<typeof ComposeRequestSchema>;

export const FlagMailRequestSchema = z.object({
    important: z.boolean(),
});

export type FlagMailRequest = z.infer<typeof FlagMailRequestSchema>;
