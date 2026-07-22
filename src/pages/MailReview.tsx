import { useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "wouter";
import { findMockMailItem } from "@/lib/mock-mail";
import type { MailItem } from "@/lib/mail-schema";
import { useMailWorkspace } from "@/lib/mail-workspace";
import MailReviewPanel from "@/components/MailReviewPanel";

export default function MailReview() {
    const { mailId } = useParams();
    const [searchParams] = useSearchParams();
    const [, navigate] = useLocation();
    const { markReviewed: moveToOutbox, draftsByMailId } = useMailWorkspace();
    const isReviewMode = searchParams.get("mode") === "review";
    const [item, setItem] = useState<MailItem | null>(() => {
        const mockItem = mailId ? findMockMailItem(mailId) : null;
        const promotionDraft = mailId ? draftsByMailId[mailId] : undefined;
        return mockItem && promotionDraft !== undefined && mockItem.analysis
            ? {
                  ...mockItem,
                  analysis: { ...mockItem.analysis, promotionDraft },
              }
            : mockItem;
    });
    const [reviewError, setReviewError] = useState<string | null>(null);

    function markReviewed(promotionDraft: string): Promise<void> {
        if (promotionDraft.trim().length === 0) {
            setReviewError("홍보 문안 초안을 입력해 주세요.");
            return Promise.resolve();
        }
        setReviewError(null);
        if (!item || item.status !== "ready") {
            setReviewError("아직 검토할 수 없는 메일입니다.");
            return Promise.resolve();
        }
        setItem({
            ...item,
            status: "reviewed",
            reviewedAt: item.receivedAt,
            analysis: item.analysis
                ? { ...item.analysis, promotionDraft }
                : item.analysis,
        });
        moveToOutbox(item.id, promotionDraft);
        navigate("/inbox?folder=outbox");
        return Promise.resolve();
    }

    return (
        <div className="min-h-[calc(100dvh-4.5rem)] space-y-6 px-6 py-8 sm:px-8 lg:px-10">
            <Link className="btn btn-ghost btn-sm" href="/inbox">
                ← 메일함으로
            </Link>
            {!item && (
                <div role="alert" className="alert alert-warning">
                    <span>메일을 찾을 수 없습니다.</span>
                </div>
            )}
            {item &&
                (isReviewMode ? (
                    <MailReviewPanel
                        item={item}
                        onReview={markReviewed}
                        reviewError={reviewError}
                    />
                ) : (
                    <section className="card border border-base-300 bg-base-100 shadow-sm">
                        <div className="card-body p-0">
                            <div className="flex flex-wrap gap-2 border-b border-base-300 px-6 py-4">
                                <button
                                    className="btn btn-ghost btn-sm"
                                    type="button"
                                >
                                    전달
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    type="button"
                                >
                                    삭제
                                </button>
                            </div>
                            <article className="p-6 sm:p-8">
                                <h1 className="text-3xl font-semibold">
                                    {item.subject}
                                </h1>
                                <div className="mt-6 border-y border-base-300 py-5 text-sm">
                                    <p>
                                        <span className="text-base-content/60">
                                            보낸사람
                                        </span>{" "}
                                        {item.senderName} &lt;
                                        {item.senderAddress}&gt;
                                    </p>
                                    <p className="mt-2">
                                        <span className="text-base-content/60">
                                            받는사람
                                        </span>{" "}
                                        {item.recipients.join(", ")}
                                    </p>
                                    <p className="mt-2">
                                        <span className="text-base-content/60">
                                            수신시각
                                        </span>{" "}
                                        {item.receivedAt
                                            .toDate()
                                            .toLocaleString("ko-KR")}
                                    </p>
                                </div>
                                <div className="min-h-96 whitespace-pre-wrap py-8 leading-8">
                                    {item.textBody}
                                </div>
                            </article>
                        </div>
                    </section>
                ))}
        </div>
    );
}
