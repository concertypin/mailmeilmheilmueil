import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
    DefaultChatTransport,
    lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { z } from "zod";
import { type MailItem } from "@/lib/mail-schema";
import { useAnalysisCriteria } from "@/lib/analysis-criteria-data";

interface MailReviewPanelProps {
    item: MailItem;
    onReview: (promotionDraft: string) => Promise<void>;
    reviewError?: string | null;
}

function displayTimestamp(timestamp: MailItem["receivedAt"]): string {
    return timestamp.toDate().toLocaleString("ko-KR");
}

function lifecycleLabel(status: MailItem["status"]): string {
    const labels: Record<MailItem["status"], string> = {
        queued: "대기 중",
        processing: "분석 중",
        ready: "검토 대기",
        failed: "분석 실패",
        reviewed: "검토 완료",
        dispatched: "발송 완료",
        sent: "발송 완료",
    };
    return labels[status];
}

export default function MailReviewPanel({
    item,
    onReview,
    reviewError,
}: MailReviewPanelProps) {
    const { fields } = useAnalysisCriteria();
    const isPending = item.status === "queued" || item.status === "processing";
    const analysis = item.analysis;
    const canReview = item.status === "ready";
    const [promotionDraft, setPromotionDraft] = useState(item.draft ?? "");
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
    const [collabInput, setCollabInput] = useState("");
    const { messages, sendMessage, addToolOutput, status } = useChat({
        transport: new DefaultChatTransport({
            api: `/api/mails/${item.id}/collab`,
        }),
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
        onToolCall({ toolCall }) {
            if (toolCall.dynamic) return;
            if (toolCall.toolName === "patchDraft") {
                const parsed = z
                    .object({ draft: z.string() })
                    .safeParse(toolCall.input);
                if (parsed.success) {
                    setPromotionDraft(parsed.data.draft);
                }
                addToolOutput({
                    tool: "patchDraft",
                    toolCallId: toolCall.toolCallId,
                    output: "초안이 업데이트되었습니다.",
                });
            }
        },
    });

    return (
        <div className="flex min-h-[calc(100dvh-15rem)] flex-col space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                    <p className="text-sm text-base-content/60">
                        수신 메일 검토
                    </p>
                    <h1 className="text-3xl font-bold">{item.subject}</h1>
                </div>
                <div className="flex flex-wrap items-start justify-end gap-5">
                    <dl className="grid gap-x-6 gap-y-2 text-right text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-base-content/55">
                                보낸사람
                            </dt>
                            <dd className="mt-1 font-medium">
                                {item.senderName} · {item.senderAddress}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-base-content/55">
                                받는사람
                            </dt>
                            <dd className="mt-1 font-medium">
                                {item.recipients.join(", ")}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-base-content/55">
                                수신시각
                            </dt>
                            <dd className="mt-1 font-medium">
                                {displayTimestamp(item.receivedAt)}
                            </dd>
                        </div>
                    </dl>
                    <span className="badge badge-primary badge-lg">
                        {lifecycleLabel(item.status)}
                    </span>
                </div>
            </div>

            {isPending && (
                <div className="card border border-base-300 bg-base-100 shadow-sm">
                    <div className="card-body gap-4">
                        <div className="skeleton h-6 w-48" />
                        <div className="skeleton h-24 w-full" />
                        <p className="text-sm text-base-content/60">
                            AI 분석 결과를 준비하고 있습니다.
                        </p>
                    </div>
                </div>
            )}

            {item.status === "failed" && (
                <div role="alert" className="alert alert-error">
                    <span>
                        {item.failureMessage ?? "AI 분석에 실패했습니다."}
                    </span>
                </div>
            )}

            <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex flex-col space-y-6">
                    {analysis ? (
                        <section className="card border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body gap-0 p-0">
                                <button
                                    aria-expanded={isAnalysisOpen}
                                    className="flex w-full items-center justify-between gap-4 p-6 text-left"
                                    onClick={() =>
                                        setIsAnalysisOpen(!isAnalysisOpen)
                                    }
                                    type="button"
                                >
                                    <div>
                                        <h2 className="card-title">
                                            AI 분석 결과
                                        </h2>
                                        <p className="mt-1 text-sm text-base-content/60">
                                            {isAnalysisOpen
                                                ? "분석된 항목을 확인하고 검토 메모를 살펴보세요."
                                                : "필요할 때 펼쳐서 분석 결과를 확인하세요."}
                                        </p>
                                    </div>
                                    <span className="badge badge-primary">
                                        {isAnalysisOpen ? "접기" : "펼치기"}
                                    </span>
                                </button>
                                {isAnalysisOpen ? (
                                    <div className="border-t border-base-300 p-6">
                                        {(() => {
                                            const categoryField = fields.find(
                                                (f) => f.isCategory
                                            );
                                            const categoryValue =
                                                categoryField &&
                                                analysis[categoryField.key];
                                            return categoryValue ? (
                                                <div className="mb-5">
                                                    <span className="badge badge-secondary">
                                                        {typeof categoryValue ===
                                                        "string"
                                                            ? categoryValue
                                                            : null}
                                                    </span>
                                                </div>
                                            ) : null;
                                        })()}
                                        <dl className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
                                            {fields.map((field) => {
                                                const value =
                                                    analysis[field.key];
                                                return (
                                                    <div key={field.key}>
                                                        <dt className="font-semibold">
                                                            {field.label}
                                                        </dt>
                                                        <dd className="mt-1 text-base-content/70">
                                                            {typeof value ===
                                                            "string" ? (
                                                                value
                                                            ) : (
                                                                <span className="text-warning">
                                                                    확인 필요
                                                                </span>
                                                            )}
                                                        </dd>
                                                    </div>
                                                );
                                            })}
                                        </dl>
                                        {analysis.reviewNotes.length > 0 ? (
                                            <div
                                                role="alert"
                                                className="alert alert-warning mt-6"
                                            >
                                                <div>
                                                    <h3 className="font-bold">
                                                        확인 필요
                                                    </h3>
                                                    <ul className="list-disc pl-5">
                                                        {analysis.reviewNotes.map(
                                                            (note) => (
                                                                <li key={note}>
                                                                    {note}
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    ) : null}

                    <div className="grid flex-1 gap-6 lg:grid-cols-2">
                        <section className="card h-full border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body h-full">
                                <h2 className="card-title">원본 메일</h2>
                                <label className="fieldset mt-2 flex flex-1 flex-col">
                                    <span className="label">원문 내용</span>
                                    <textarea
                                        aria-label="원문 내용"
                                        className="textarea min-h-64 w-full flex-1 resize-none bg-base-200"
                                        readOnly
                                        value={item.textBody}
                                    />
                                </label>
                            </div>
                        </section>

                        {analysis ? (
                            <section className="card h-full border border-primary/30 bg-base-100 shadow-sm">
                                <div className="card-body h-full">
                                    <h2 className="card-title">
                                        홍보 문안 초안
                                    </h2>
                                    <label className="fieldset mt-2 flex flex-1 flex-col">
                                        <span className="label">초안 내용</span>
                                        <textarea
                                            aria-label="홍보 문안 초안"
                                            className="textarea min-h-64 w-full flex-1"
                                            onChange={(event) =>
                                                setPromotionDraft(
                                                    event.currentTarget.value
                                                )
                                            }
                                            value={promotionDraft}
                                        />
                                    </label>
                                    {reviewError ? (
                                        <div
                                            role="alert"
                                            className="alert alert-error mt-4"
                                        >
                                            <span>{reviewError}</span>
                                        </div>
                                    ) : null}
                                    {canReview ? (
                                        <button
                                            className="btn btn-primary mt-4 self-start"
                                            disabled={
                                                promotionDraft.trim().length ===
                                                0
                                            }
                                            onClick={() => {
                                                if (
                                                    promotionDraft.trim()
                                                        .length === 0
                                                ) {
                                                    return;
                                                }
                                                void onReview(
                                                    promotionDraft.trim()
                                                );
                                            }}
                                        >
                                            검토 완료
                                        </button>
                                    ) : null}
                                </div>
                            </section>
                        ) : null}
                    </div>
                </div>

                {analysis ? (
                    <aside className="card h-fit self-start border border-base-300 bg-base-100 shadow-sm xl:sticky xl:top-24">
                        <div className="card-body gap-0 p-0">
                            <div className="border-b border-base-300 p-5">
                                <p className="text-sm font-semibold text-primary">
                                    DRAFT ASSISTANT
                                </p>
                                <h2 className="card-title mt-1">
                                    초안 협업 세션
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-base-content/60">
                                    초안의 톤, 길이, 강조할 내용을 대화로
                                    요청하세요.
                                </p>
                            </div>
                            <div className="space-y-4 p-5">
                                {messages.length === 0 ? (
                                    <div className="chat chat-start">
                                        <div className="chat-bubble chat-bubble-neutral text-sm">
                                            현재 홍보 초안을 함께 다듬을 준비가
                                            됐어요. 어떤 방향으로 바꿔볼까요?
                                        </div>
                                    </div>
                                ) : null}
                                {messages.map((message) => (
                                    <div key={message.id}>
                                        {message.parts.map((part) => {
                                            switch (part.type) {
                                                case "text":
                                                    return (
                                                        <div
                                                            className={`chat ${message.role === "user" ? "chat-end" : "chat-start"}`}
                                                            key={`${message.id}-${part.type}`}
                                                        >
                                                            <div
                                                                className={`chat-bubble text-sm ${message.role === "user" ? "chat-bubble-primary" : "chat-bubble-neutral"}`}
                                                            >
                                                                {part.text}
                                                            </div>
                                                        </div>
                                                    );
                                                case "tool-patchDraft":
                                                    switch (part.state) {
                                                        case "input-streaming":
                                                        case "input-available":
                                                            return (
                                                                <div
                                                                    className="chat chat-start"
                                                                    key={`${message.id}-tool-patchDraft`}
                                                                >
                                                                    <div className="chat-bubble chat-bubble-neutral text-sm">
                                                                        초안
                                                                        업데이트
                                                                        중...
                                                                    </div>
                                                                </div>
                                                            );
                                                        case "output-available":
                                                            return (
                                                                <div
                                                                    className="chat chat-start"
                                                                    key={`${message.id}-tool-patchDraft`}
                                                                >
                                                                    <div className="chat-bubble chat-bubble-neutral text-sm">
                                                                        ✅
                                                                        초안이
                                                                        업데이트되었습니다.
                                                                    </div>
                                                                </div>
                                                            );
                                                        case "output-error":
                                                            return (
                                                                <div
                                                                    className="chat chat-start"
                                                                    key={`${message.id}-tool-patchDraft`}
                                                                >
                                                                    <div className="chat-bubble chat-bubble-neutral text-sm">
                                                                        ❌ 오류:
                                                                        {part.errorText ??
                                                                            "초안 업데이트 실패"}
                                                                    </div>
                                                                </div>
                                                            );
                                                    }
                                                    break;
                                                default:
                                                    return null;
                                            }
                                        })}
                                    </div>
                                ))}
                                {status === "streaming" ? (
                                    <div className="chat chat-start">
                                        <div className="chat-bubble chat-bubble-neutral text-sm">
                                            <span className="loading loading-dots loading-xs" />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            <div className="border-t border-base-300 p-4">
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        if (collabInput.trim().length === 0)
                                            return;
                                        void sendMessage({
                                            text: collabInput.trim(),
                                        });
                                        setCollabInput("");
                                    }}
                                >
                                    <textarea
                                        aria-label="초안 재작성 요청"
                                        className="textarea h-24 w-full"
                                        onChange={(event) =>
                                            setCollabInput(
                                                event.currentTarget.value
                                            )
                                        }
                                        placeholder="예: 대학생에게 더 친근한 톤으로 짧게 작성해줘"
                                        value={collabInput}
                                    />
                                    <button
                                        className="btn btn-primary btn-sm mt-3 w-full"
                                        disabled={
                                            collabInput.trim().length === 0 ||
                                            status === "submitted" ||
                                            status === "streaming"
                                        }
                                        type="submit"
                                    >
                                        {status === "submitted" ||
                                        status === "streaming"
                                            ? "처리 중..."
                                            : "요청 보내기"}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </aside>
                ) : null}
            </div>
        </div>
    );
}
