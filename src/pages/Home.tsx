import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeToMailItems } from "@/lib/firebase";
import type { MailItem } from "@/lib/mail-schema";
import { z } from "zod";

const SyncResultSchema = z.object({
    imported: z.number(),
    duplicates: z.number(),
    rejected: z.number(),
});

function statusLabel(status: MailItem["status"]): string {
    const labels = {
        queued: "대기 중",
        processing: "분석 중",
        ready: "검토 대기",
        failed: "분석 실패",
        reviewed: "검토 완료",
    } satisfies Record<MailItem["status"], string>;
    return labels[status];
}

export default function Home() {
    const [items, setItems] = useState<MailItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncAuthError, setSyncAuthError] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToMailItems(
            (nextItems) => {
                setItems(nextItems);
                setLoading(false);
            },
            (nextError) => {
                setError(nextError.message);
                setLoading(false);
            }
        );
        return unsubscribe;
    }, []);

    const handleSync = () => {
        setSyncing(true);
        setSyncResult(null);
        setSyncError(null);
        setSyncAuthError(false);
        fetch("/api/imap/sync", {
            method: "POST",
            credentials: "same-origin",
        })
            .then(async (response) => {
                if (response.ok) {
                    const data = SyncResultSchema.parse(await response.json());
                    setSyncResult(
                        `가져온 메일 ${data.imported}건 · 이미 처리된 메일 ${data.duplicates}건 · 제외된 메일 ${data.rejected}건`
                    );
                } else if (response.status === 401) {
                    setSyncError(
                        "메일 연결이 만료되었습니다. 다시 로그인해 주세요."
                    );
                    setSyncAuthError(true);
                } else {
                    setSyncError(
                        "메일 동기화에 실패했습니다. 잠시 후 다시 시도해 주세요."
                    );
                }
            })
            .catch(() => {
                setSyncError(
                    "메일 동기화에 실패했습니다. 잠시 후 다시 시도해 주세요."
                );
            })
            .finally(() => {
                setSyncing(false);
            });
    };

    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm text-primary">staff review inbox</p>
                <h1 className="text-3xl font-bold">공유 메일함</h1>
                <p className="mt-2 text-base-content/70">
                    연결한 메일함 또는 테스트 SMTP로 수신한 메일의 AI 분석과
                    홍보 초안을 검토합니다.
                </p>
            </div>

            {syncError && (
                <div role="alert" className="alert alert-warning">
                    <span>{syncError}</span>
                    {syncAuthError && (
                        <Link className="link" to="/login">
                            로그인 페이지로 이동
                        </Link>
                    )}
                </div>
            )}

            <div className="flex items-center gap-4">
                <button
                    className="btn btn-primary"
                    onClick={handleSync}
                    disabled={syncing}
                >
                    {syncing && <span className="loading loading-spinner" />}
                    메일 동기화
                </button>
                {syncResult && (
                    <span className="text-sm text-base-content/70">
                        {syncResult}
                    </span>
                )}
            </div>

            {error && (
                <div role="alert" className="alert alert-error">
                    <span>메일함을 불러오지 못했습니다: {error}</span>
                </div>
            )}
            {loading && (
                <div className="space-y-3">
                    <div className="skeleton h-20 w-full" />
                    <div className="skeleton h-20 w-full" />
                </div>
            )}
            {!loading && items.length === 0 && (
                <div className="alert alert-info">
                    아직 수신된 메일이 없습니다. 테스트 메일을 보내면 여기에서
                    검토할 수 있습니다.
                </div>
            )}
            <div className="space-y-3">
                {items.map((item) => (
                    <Link
                        key={item.id}
                        to={`/mails/${item.id}`}
                        className="card border border-base-300 bg-base-100 shadow-sm transition hover:border-primary"
                    >
                        <div className="card-body p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm text-base-content/60">
                                        {item.senderName} · {item.senderAddress}
                                    </p>
                                    <h2 className="mt-1 text-lg font-semibold">
                                        {item.subject}
                                    </h2>
                                    <p className="mt-2 line-clamp-2 text-sm text-base-content/70">
                                        {item.textBody}
                                    </p>
                                </div>
                                <span className="badge badge-outline">
                                    {statusLabel(item.status)}
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
