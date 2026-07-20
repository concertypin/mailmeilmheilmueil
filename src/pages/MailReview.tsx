import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { subscribeToMailItem } from "@/lib/firebase";
import type { MailItem } from "@/lib/mail-schema";
import MailReviewPanel from "@/components/MailReviewPanel";

export default function MailReview() {
    const { mailId } = useParams();
    const [item, setItem] = useState<MailItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reviewError, setReviewError] = useState<string | null>(null);

    useEffect(() => {
        if (!mailId) {
            setError("메일 ID가 없습니다.");
            setLoading(false);
            return undefined;
        }
        const unsubscribe = subscribeToMailItem(
            mailId,
            (nextItem) => {
                setItem(nextItem);
                setLoading(false);
            },
            (nextError) => {
                setError(nextError.message);
                setLoading(false);
            }
        );
        return unsubscribe;
    }, [mailId]);

    async function markReviewed(): Promise<void> {
        if (!mailId) return;
        setReviewError(null);
        const response = await fetch(`/api/mails/${encodeURIComponent(mailId)}/review`, { method: "POST" });
        if (!response.ok) {
            setReviewError("아직 검토할 수 없는 메일입니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    return (
        <div className="space-y-6">
            <Link className="btn btn-ghost btn-sm" to="/">← 메일함으로</Link>
            {loading && <div className="skeleton h-56 w-full" />}
            {error && <div role="alert" className="alert alert-error"><span>{error}</span></div>}
            {!loading && !error && !item && <div role="alert" className="alert alert-warning"><span>메일을 찾을 수 없습니다.</span></div>}
            {item && <MailReviewPanel item={item} onReview={markReviewed} reviewError={reviewError} />}
        </div>
    );
}
