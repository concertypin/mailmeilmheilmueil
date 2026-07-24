import { type MailAnalysis, type MailItem } from "../../src/lib/mail-schema";
import { firestoreRepository, now, type MailRepository } from "./repository";
import { analyzeMail, generateDraft } from "./analysis";

export type MailAnalyzer = (item: MailItem) => Promise<MailAnalysis>;

export type DraftGenerator = (item: MailItem, analysis: MailAnalysis) => string;

export const AI_FAILURE_MESSAGE =
    "AI 분석에 실패했습니다. 테스트 메일을 다시 보내 주세요.";

/** Process one queued mail: analyze → generate draft → update repository. */
export async function processMailItem(
    id: string,
    repository: MailRepository = firestoreRepository,
    analyzer: MailAnalyzer = analyzeMail,
    draftGenerator: DraftGenerator = generateDraft
): Promise<"ready" | "failed"> {
    const item = await repository.get(id);
    if (!item) {
        throw new Error(`Mail item ${id} was not found`);
    }

    await repository.update(id, { status: "processing", failureMessage: null });
    try {
        const analysis = await analyzer(item);
        await repository.update(id, {
            analysis,
            processedAt: now(),
            status: "ready",
            failureMessage: null,
        });
        // Generate draft from analysis (sync formatting, no AI)
        try {
            const draft = draftGenerator(item, analysis);
            if (draft) {
                repository.update(id, { draft }).catch(() => undefined);
            }
        } catch {
            /* draft formatting is best-effort */
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
