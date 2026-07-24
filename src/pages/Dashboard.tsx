import { useCallback, useEffect, useRef, useState } from "react";
import {
    ChartBar,
    ArrowsClockwise,
    WarningCircle,
} from "@phosphor-icons/react";
import { Link } from "wouter";
import { useMailData } from "@/lib/mail-data";
import {
    buildImapHeaders,
    loadImapBasicCredentials,
} from "@/lib/imap-basic";
import { type MailItem } from "@/lib/mail-schema";

interface DashboardStats {
    total: number;
    ready: number;
    reviewed: number;
    sent: number;
    failed: number;
}

function computeStats(items: MailItem[]): DashboardStats {
    const stats: DashboardStats = {
        total: items.length,
        ready: 0,
        reviewed: 0,
        sent: 0,
        failed: 0,
    };
    for (const item of items) {
        if (item.status === "ready") stats.ready += 1;
        else if (item.status === "reviewed") stats.reviewed += 1;
        else if (item.status === "sent") stats.sent += 1;
        else if (item.status === "failed") stats.failed += 1;
    }
    return stats;
}

export default function Dashboard() {
    const { items, isLoading, loadError, refresh } = useMailData();
    const stats = items ? computeStats(items) : null;
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [syncMessageKind, setSyncMessageKind] = useState<
        "success" | "error" | null
    >(null);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const handleSync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncMessage(null);
        setSyncMessageKind(null);
        try {
            const credentials = loadImapBasicCredentials();
            if (!credentials) return;
            const headers = buildImapHeaders(credentials);
            const res = await fetch("/api/sync", {
                method: "POST",
                headers,
            });
            if (!res.ok) {
                const body: unknown = await res.json().catch(() => null);
                const message =
                    typeof body === "object" &&
                    body !== null &&
                    "error" in body &&
                    typeof body.error === "string"
                        ? body.error
                        : "동기화 실패";
                throw new Error(message);
            }
            const result: {
                imported: number;
                duplicates: number;
                rejected: number;
            } = await res.json();
            setSyncMessage(
                `${result.imported}개 새 메일, ${result.duplicates}개 중복`
            );
            setSyncMessageKind("success");
            syncTimerRef.current = setTimeout(() => {
                setSyncMessage(null);
                setSyncMessageKind(null);
            }, 5000);
            refresh();
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : "동기화에 실패했습니다";
            setSyncMessage(msg);
            setSyncMessageKind("error");
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, refresh]);

    useEffect(() => {
        return () => clearTimeout(syncTimerRef.current);
    }, []);

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold">
                        <ChartBar aria-hidden="true" size={24} weight="bold" />
                        대시보드
                    </h1>
                    <p className="mt-1 text-sm text-base-content/60">
                        메일 홍보 검토 현황입니다.
                    </p>
                </div>
                <button
                    className="btn btn-primary btn-sm"
                    disabled={isSyncing}
                    onClick={() => void handleSync()}
                    type="button"
                >
                    {isSyncing ? (
                        <span className="loading loading-spinner loading-sm" />
                    ) : (
                        <ArrowsClockwise
                            aria-hidden="true"
                            size={18}
                            weight="bold"
                        />
                    )}
                    메일 불러오기
                </button>
            </div>

            {loadError ? (
                <div role="alert" className="alert alert-error mt-6">
                    <WarningCircle aria-hidden="true" size={20} weight="bold" />
                    <span>{loadError}</span>
                </div>
            ) : null}

            {syncMessage ? (
                <div
                    role="alert"
                    className={`alert mt-4 ${
                        syncMessageKind === "error"
                            ? "alert-error"
                            : "alert-success"
                    }`}
                >
                    <span>{syncMessage}</span>
                </div>
            ) : null}

            {isLoading ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className="card border border-base-300 bg-base-100 shadow-sm"
                        >
                            <div className="card-body">
                                <div className="skeleton h-4 w-20" />
                                <div className="skeleton mt-2 h-8 w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : stats ? (
                <>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="card border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <p className="text-sm text-base-content/60">
                                    전체 메일
                                </p>
                                <p className="mt-1 text-4xl font-bold text-base-content">
                                    {stats.total}
                                </p>
                            </div>
                        </div>
                        <div className="card border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <p className="text-sm text-base-content/60">
                                    검토 가능
                                </p>
                                <p className="mt-1 text-4xl font-bold text-success">
                                    {stats.ready}
                                </p>
                            </div>
                        </div>
                        <div className="card border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <p className="text-sm text-base-content/60">
                                    검토 완료
                                </p>
                                <p className="mt-1 text-4xl font-bold text-info">
                                    {stats.reviewed}
                                </p>
                            </div>
                        </div>
                        <div className="card border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <p className="text-sm text-base-content/60">
                                    발송 완료
                                </p>
                                <p className="mt-1 text-4xl font-bold text-primary">
                                    {stats.sent}
                                </p>
                            </div>
                        </div>
                        <div className="card border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <p className="text-sm text-base-content/60">
                                    분석 실패
                                </p>
                                <p className="mt-1 text-4xl font-bold text-error">
                                    {stats.failed}
                                </p>
                            </div>
                        </div>
                        <div className="card border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body items-center justify-center">
                                <p className="text-sm text-base-content/60">
                                    검토 진행률
                                </p>
                                <p className="mt-1 text-4xl font-bold text-secondary">
                                    {stats.total === 0
                                        ? 0
                                        : Math.round(
                                              ((stats.ready +
                                                  stats.reviewed +
                                                  stats.sent) /
                                                  stats.total) *
                                                  100
                                          )}
                                    %
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link className="btn btn-outline btn-sm" href="/inbox">
                            메일함 보기
                        </Link>
                        <Link
                            className="btn btn-outline btn-sm"
                            href="/inbox?folder=review"
                        >
                            검토할 메일 ({stats.ready})
                        </Link>
                        <Link
                            className="btn btn-outline btn-sm"
                            href="/compose"
                        >
                            메일 작성
                        </Link>
                    </div>
                </>
            ) : null}
        </div>
    );
}
