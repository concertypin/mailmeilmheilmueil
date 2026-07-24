import {
    DEFAULT_ANALYSIS_FIELDS,
    isMailAnalysisRefusal,
    type AnalysisField,
    type MailAnalysis,
    type MailItem,
} from "../../src/lib/mail-schema";
import { firestoreRepository, now, type MailRepository } from "./repository";
import { analyzeMail, generateDraft } from "./analysis";

export type MailAnalyzer = (
    item: MailItem,
    fields: readonly AnalysisField[]
) => Promise<MailAnalysis>;

export type DraftGenerator = (
    item: MailItem,
    analysis: MailAnalysis,
    fields: readonly AnalysisField[]
) => string;

export const AI_FAILURE_MESSAGE =
    "AI 분석에 실패했습니다. 테스트 메일을 다시 보내 주세요.";

export type ProcessMailOptions = {
    fields?: readonly AnalysisField[];
    analyzer?: MailAnalyzer;
    draftGenerator?: DraftGenerator;
};

/** Process one queued mail: analyze → generate draft → update repository. */
export async function processMailItem(
    id: string,
    repository: MailRepository = firestoreRepository,
    options: ProcessMailOptions = {}
): Promise<"ready" | "failed"> {
    const fields = options.fields ?? DEFAULT_ANALYSIS_FIELDS;
    const analyzer = options.analyzer ?? analyzeMail;
    const draftGenerator = options.draftGenerator ?? generateDraft;
    const item = await repository.get(id);
    if (!item) {
        throw new Error(`Mail item ${id} was not found`);
    }

    await repository.update(id, { status: "processing", failureMessage: null });
    try {
        const analysis = await analyzer(item, fields);
        await repository.update(id, {
            analysis,
            processedAt: now(),
            status: "ready",
            failureMessage: null,
        });
        if (!isMailAnalysisRefusal(analysis)) {
            // Generate draft from analysis (sync formatting, no AI)
            try {
                const draft = draftGenerator(item, analysis, fields);
                if (draft) {
                    repository.update(id, { draft }).catch(() => undefined);
                }
            } catch {
                /* draft formatting is best-effort */
            }
        }
        return "ready";
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? `AI 분석 실패: ${error.message}`
                : AI_FAILURE_MESSAGE;
        await repository.update(id, {
            processedAt: now(),
            status: "failed",
            failureMessage: message,
        });
        return "failed";
    }
}
