import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "wouter";
import type { MailItem } from "@/lib/mail-schema";
import { useMailData } from "@/lib/mail-data";
import MailSidebar from "@/components/MailSidebar";
import MailReviewPanel from "@/components/MailReviewPanel";

export default function MailReview() {
    const { mailId } = useParams();
    const [searchParams] = useSearchParams();
    const [, navigate] = useLocation();
    const { get, review, items } = useMailData();
    const isReviewMode = searchParams.get("mode") === "review";
    const [item, setItem] = useState<MailItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reviewError, setReviewError] = useState<string | null>(null);

    useEffect(() => {
        if (!mailId) {
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        setLoadError(null);
        get(mailId)
            .then((result) => {
                if (!cancelled) {
                    setItem(result);
                    setIsLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setLoadError(
                        err instanceof Error ? err.message : String(err)
                    );
                    setIsLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [mailId, get]);

    async function markReviewed(promotionDraft: string): Promise<void> {
        if (promotionDraft.trim().length === 0) {
            setReviewError("홍보 문안 초안을 입력해 주세요.");
            return;
        }
        setReviewError(null);
        if (!item || item.status !== "ready") {
            setReviewError("아직 검토할 수 없는 메일입니다.");
            return;
        }
        try {
            await review(item, promotionDraft);
            navigate("/inbox?folder=outbox");
        } catch (err: unknown) {
            setReviewError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <div className="min-h-[calc(100vh-4.5rem)] bg-base-200">
            <div className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
                <MailSidebar activePage="inbox" items={items} />
                <main className="min-h-[calc(100vh-4.5rem)] space-y-6 bg-base-100 px-6 py-8 sm:px-8 lg:px-10">
                    <Link className="btn btn-ghost btn-sm" href="/inbox">
                        ← 메일함으로
                    </Link>
                    {isLoading ? (
                        <div role="alert" className="alert alert-info">
                            <span>메일을 불러오는 중...</span>
                        </div>
                    ) : null}
                    {loadError ? (
                        <div role="alert" className="alert alert-error">
                            <span>메일을 불러오지 못했습니다: {loadError}</span>
                        </div>
                    ) : null}
                    {!isLoading && !loadError && !item ? (
                        <div role="alert" className="alert alert-warning">
                            <span>메일을 찾을 수 없습니다.</span>
                        </div>
                    ) : null}
                    {item && !isLoading ? (
                        isReviewMode ? (
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
                        )
                    ) : null}
                </main>
            </div>
        </div>
    );
}
