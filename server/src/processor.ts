import { type MailAnalysis, type MailItem } from "../../src/lib/mail-schema";
import { firestoreRepository, now, type MailRepository } from "./repository";
import { analyzeMail } from "./analysis";

export type MailAnalyzer = (item: MailItem) => Promise<MailAnalysis>;

export const AI_FAILURE_MESSAGE = "AI 분석에 실패했습니다. 테스트 메일을 다시 보내 주세요.";

/** Process one queued mail and retain the original when analysis fails. */
export async function processMailItem(
    id: string,
    repository: MailRepository = firestoreRepository,
    analyzer: MailAnalyzer = analyzeMail
): Promise<void> {
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
    } catch (error) {
        process.stderr.write(`Mail analysis failed: ${String(error)}\n`);
        await repository.update(id, {
            processedAt: now(),
            status: "failed",
            failureMessage: AI_FAILURE_MESSAGE,
        });
    }
}
