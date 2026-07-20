import { type MailItem } from "@/lib/mail-schema";

interface MailReviewPanelProps {
    item: MailItem;
    onReview: () => Promise<void>;
    reviewError?: string | null;
}

const fieldLabels = [
    ["audience", "대상"],
    ["schedule", "일정"],
    ["applicationDeadline", "신청 마감"],
    ["benefits", "혜택"],
    ["applicationMethod", "신청 방법"],
    ["contactOrReference", "문의·참고"],
] as const;

function displayTimestamp(timestamp: MailItem["receivedAt"]): string {
    return timestamp.toDate().toLocaleString("ko-KR");
}

function lifecycleLabel(status: MailItem["status"]): string {
    const labels = {
        queued: "대기 중",
        processing: "분석 중",
        ready: "검토 대기",
        failed: "분석 실패",
        reviewed: "검토 완료",
    } satisfies Record<MailItem["status"], string>;
    return labels[status];
}

export default function MailReviewPanel({ item, onReview, reviewError }: MailReviewPanelProps) {
    const analysis = item.analysis;
    const isPending = item.status === "queued" || item.status === "processing";
    const canReview = item.status === "ready";

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm text-base-content/60">수신 메일 검토</p>
                    <h1 className="text-3xl font-bold">{item.subject}</h1>
                </div>
                <span className="badge badge-primary badge-lg">{lifecycleLabel(item.status)}</span>
            </div>

            {isPending && (
                <div className="card border border-base-300 bg-base-100 shadow-sm">
                    <div className="card-body gap-4">
                        <div className="skeleton h-6 w-48" />
                        <div className="skeleton h-24 w-full" />
                        <p className="text-sm text-base-content/60">AI 분석 결과를 준비하고 있습니다.</p>
                    </div>
                </div>
            )}

            {item.status === "failed" && (
                <div role="alert" className="alert alert-error">
                    <span>{item.failureMessage ?? "AI 분석에 실패했습니다."}</span>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="card border border-base-300 bg-base-100 shadow-sm">
                    <div className="card-body">
                        <h2 className="card-title">원본 메일</h2>
                        <dl className="space-y-3 text-sm">
                            <div><dt className="font-semibold">보낸 사람</dt><dd>{item.senderName} &lt;{item.senderAddress}&gt;</dd></div>
                            <div><dt className="font-semibold">받는 사람</dt><dd>{item.recipients.join(", ")}</dd></div>
                            <div><dt className="font-semibold">수신 시각</dt><dd>{displayTimestamp(item.receivedAt)}</dd></div>
                            <div><dt className="font-semibold">제목</dt><dd>{item.subject}</dd></div>
                        </dl>
                        <div className="mt-4 rounded-box bg-base-200 p-4">
                            <pre className="whitespace-pre-wrap font-sans text-sm">{item.textBody}</pre>
                        </div>
                    </div>
                </section>

                {analysis && (
                    <section className="card border border-base-300 bg-base-100 shadow-sm">
                        <div className="card-body">
                            <h2 className="card-title">AI 분석 결과</h2>
                            <div className="mb-3"><span className="badge badge-secondary">{analysis.category}</span></div>
                            <dl className="space-y-3 text-sm">
                                {fieldLabels.map(([key, label]) => {
                                    const value = analysis[key];
                                    return <div key={key}><dt className="font-semibold">{label}</dt><dd>{value ?? <span className="text-warning">확인 필요</span>}</dd></div>;
                                })}
                            </dl>
                        </div>
                    </section>
                )}
            </div>

            {analysis && (
                <section className="card border border-primary/30 bg-base-100 shadow-sm">
                    <div className="card-body">
                        <h2 className="card-title">홍보 문안 초안</h2>
                        <div className="rounded-box bg-base-200 p-4"><p className="whitespace-pre-wrap">{analysis.promotionDraft}</p></div>
                        {analysis.reviewNotes.length > 0 && (
                            <div role="alert" className="alert alert-warning mt-4">
                                <div>
                                    <h3 className="font-bold">확인 필요</h3>
                                    <ul className="list-disc pl-5">{analysis.reviewNotes.map((note) => <li key={note}>{note}</li>)}</ul>
                                </div>
                            </div>
                        )}
                        {reviewError && <div role="alert" className="alert alert-error mt-4"><span>{reviewError}</span></div>}
                        {canReview && <button className="btn btn-primary mt-4 self-start" type="button" onClick={() => { void onReview(); }}>검토 완료로 표시</button>}
                    </div>
                </section>
            )}
        </div>
    );
}
