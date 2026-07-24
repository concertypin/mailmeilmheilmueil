import { useRef, useState } from "react";
import {
    FunnelIcon,
    EnvelopeSimpleIcon,
    MagnifyingGlassIcon,
    StarIcon,
} from "@phosphor-icons/react";
import { Link, useSearchParams } from "wouter";
import { useMailData } from "@/lib/mail-data";
import MailSidebar from "@/components/MailSidebar";
import {
    buildImapHeaders,
    encodeImapBasicAuthorization,
    loadImapBasicCredentials,
    redirectForInvalidImapCredentials,
} from "@/lib/imap-basic";
import { type MailItem } from "@/lib/mail-schema";
import { useAnalysisCriteria } from "@/lib/analysis-criteria-data";
import PendingSendFlow from "@/components/PendingSendFlow";
function statusLabel(status: MailItem["status"]): string {
    const labels = {
        queued: "대기 중",
        processing: "분석 중",
        ready: "검토 대기",
        failed: "분석 실패",
        reviewed: "검토 완료",
        dispatched: "발송 완료",
        sent: "발송 완료",
    } satisfies Record<MailItem["status"], string>;
    return labels[status];
}

export default function Home() {
    const { fields } = useAnalysisCriteria();
    const categoryField = fields.find((f) => f.isCategory);
    const [selectedMailIds, setSelectedMailIds] = useState<Set<string>>(
        new Set()
    );
    const [searchTerm, setSearchTerm] = useState("");
    const [senderFilter, setSenderFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [audienceFilter, setAudienceFilter] = useState("");
    const [scheduleFilter, setScheduleFilter] = useState("");
    const [deadlineFilter, setDeadlineFilter] = useState("");
    const [benefitsFilter, setBenefitsFilter] = useState("");
    const [applicationMethodFilter, setApplicationMethodFilter] = useState("");
    const [contactFilter, setContactFilter] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [promotionDraftMessage, setPromotionDraftMessage] = useState<
        string | null
    >(null);
    const flaggingRef = useRef(new Set<string>());
    const [searchParams] = useSearchParams();
    const [activeMailbox, setActiveMailbox] = useState<
        "inbox" | "important" | "review" | "outbox" | "sent"
    >(() => {
        const folder = searchParams.get("folder");
        return folder === "important" ||
            folder === "review" ||
            folder === "outbox" ||
            folder === "sent"
            ? folder
            : "inbox";
    });
    const { items, isLoading, loadError, refresh } = useMailData();

    // ── Sync state ────────────────────────────────────────────────
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [syncMessageKind, setSyncMessageKind] = useState<
        "success" | "error" | null
    >(null);
    const [showSyncCheck, setShowSyncCheck] = useState(false);

    const handleSync = async () => {
        const credentials = loadImapBasicCredentials();
        if (!credentials) {
            redirectForInvalidImapCredentials();
            return;
        }
        setIsSyncing(true);
        setSyncMessage(null);
        setSyncMessageKind(null);
        try {
            const headers = buildImapHeaders(credentials);
            const response = await fetch("/api/sync", {
                method: "POST",
                headers,
            });
            if (!response.ok) {
                if (response.status === 401) {
                    redirectForInvalidImapCredentials();
                    return;
                }
                const body: unknown = await response.json().catch(() => null);
                const message =
                    body !== null &&
                    typeof body === "object" &&
                    "error" in body &&
                    typeof body.error === "string"
                        ? body.error
                        : "동기화에 실패했습니다.";
                setSyncMessage(message);
                setSyncMessageKind("error");
                return;
            }
            try {
                await refresh();
            } catch {
                setSyncMessage("메일함 업데이트에 실패했습니다.");
                setSyncMessageKind("error");
                return;
            }
            setShowSyncCheck(true);
            setTimeout(() => setShowSyncCheck(false), 2000);
        } catch {
            setSyncMessage("동기화에 실패했습니다.");
            setSyncMessageKind("error");
        } finally {
            setIsSyncing(false);
        }
    };

    const retryingRef = useRef<Set<string>>(new Set());
    const handleRetryAnalysis = async (id: string) => {
        if (retryingRef.current.has(id)) return;
        retryingRef.current.add(id);
        try {
            const credentials = loadImapBasicCredentials();
            if (!credentials) {
                redirectForInvalidImapCredentials();
                return;
            }
            const auth = encodeImapBasicAuthorization(
                credentials.account,
                credentials.password
            );
            const response = await fetch(`/api/mails/${id}/retry-analysis`, {
                method: "POST",
                headers: { authorization: auth },
            });
            if (response.status === 401) {
                redirectForInvalidImapCredentials();
                return;
            }
            try {
                await refresh();
            } catch {
                /* refresh error is non-fatal */
            }
        } catch {
            /* network error is non-fatal */
        } finally {
            retryingRef.current.delete(id);
        }
    };
    const visibleMailItems = (items ?? []).filter((item) => {
        if (activeMailbox === "review") {
            return item.status === "ready" && item.analysis !== null;
        }
        if (activeMailbox === "outbox") {
            return item.status === "reviewed";
        }
        if (activeMailbox === "sent") {
            return item.status === "sent";
        }
        if (activeMailbox === "important") {
            return item.isImportant === true;
        }
        return (
            item.status !== "reviewed" &&
            item.status !== "sent" &&
            item.status !== "dispatched"
        );
    });
    const activeMailboxTitle =
        activeMailbox === "inbox"
            ? "받은메일함"
            : activeMailbox === "important"
              ? "중요 메일"
              : activeMailbox === "review"
                ? "홍보 메일 검토"
                : activeMailbox === "sent"
                  ? "보낸메일함"
                  : "발송 대기";
    const distinctCategories = [
        ...new Set(
            visibleMailItems
                .map((item) =>
                    categoryField ? item.analysis?.[categoryField.key] : null
                )
                .filter((value): value is string => Boolean(value))
        ),
    ].sort();

    const filteredMailItems = visibleMailItems.filter((item) => {
        const receivedDate = item.receivedAt
            .toDate()
            .toISOString()
            .slice(0, 10);
        const analysis = item.analysis;
        const analysisField = (key: string) => {
            const descriptor =
                analysis && Object.getOwnPropertyDescriptor(analysis, key);
            return typeof descriptor?.value === "string"
                ? descriptor.value
                : "";
        };
        const searchableValues = analysis
            ? Object.values(analysis).filter(
                  (value): value is string =>
                      typeof value === "string" && value.length > 0
              )
            : [];
        const searchableText = [
            item.senderName,
            item.senderAddress,
            item.subject,
            item.textBody,
            ...searchableValues,
            ...(analysis?.reviewNotes ?? []),
            item.draft ?? "",
        ]
            .filter((value): value is string => Boolean(value))
            .join(" ")
            .toLowerCase();
        const matchesSearch = searchableText.includes(
            searchTerm.trim().toLowerCase()
        );
        const senderQuery = senderFilter.trim().toLowerCase();
        const matchesSender =
            item.senderName.toLowerCase().includes(senderQuery) ||
            item.senderAddress.toLowerCase().includes(senderQuery);
        const matchesDateFrom = dateFrom === "" || receivedDate >= dateFrom;
        const matchesDateTo = dateTo === "" || receivedDate <= dateTo;
        const categoryValue = categoryField
            ? analysis?.[categoryField.key]
            : null;
        const matchesCategory =
            categoryFilter === "all" ||
            (typeof categoryValue === "string" &&
                categoryValue === categoryFilter);
        const audienceQuery = audienceFilter.trim().toLowerCase();
        const scheduleQuery = scheduleFilter.trim().toLowerCase();
        const deadlineQuery = deadlineFilter.trim().toLowerCase();
        const benefitsQuery = benefitsFilter.trim().toLowerCase();
        const applicationMethodQuery = applicationMethodFilter
            .trim()
            .toLowerCase();
        const contactQuery = contactFilter.trim().toLowerCase();
        const matchesAudience =
            audienceQuery === "" ||
            analysisField("audience").toLowerCase().includes(audienceQuery);
        const matchesSchedule =
            scheduleQuery === "" ||
            analysisField("schedule").toLowerCase().includes(scheduleQuery);
        const matchesDeadline =
            deadlineQuery === "" ||
            analysisField("applicationDeadline")
                .toLowerCase()
                .includes(deadlineQuery);
        const matchesBenefits =
            benefitsQuery === "" ||
            analysisField("benefits").toLowerCase().includes(benefitsQuery);
        const matchesApplicationMethod =
            applicationMethodQuery === "" ||
            analysisField("applicationMethod")
                .toLowerCase()
                .includes(applicationMethodQuery);
        const matchesContact =
            contactQuery === "" ||
            analysisField("contactOrReference")
                .toLowerCase()
                .includes(contactQuery);
        return (
            matchesSearch &&
            matchesSender &&
            matchesDateFrom &&
            matchesDateTo &&
            matchesCategory &&
            matchesAudience &&
            matchesSchedule &&
            matchesDeadline &&
            matchesBenefits &&
            matchesApplicationMethod &&
            matchesContact
        );
    });
    return (
        <div className="min-h-[calc(100vh-4.5rem)] bg-base-200">
            <div className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
                <MailSidebar
                    activeMailbox={activeMailbox}
                    activePage="inbox"
                    items={items}
                    onMailboxChange={setActiveMailbox}
                />

                <section className="bg-base-100">
                    {isLoading ? (
                        <div
                            role="alert"
                            className="alert alert-info mx-5 mt-4 sm:mx-8"
                        >
                            <span>메일을 불러오는 중...</span>
                        </div>
                    ) : null}
                    {loadError ? (
                        <div
                            role="alert"
                            className="alert alert-error mx-5 mt-4 sm:mx-8"
                        >
                            <span>메일을 불러오지 못했습니다: {loadError}</span>
                        </div>
                    ) : null}
                    {activeMailbox === "outbox" ? (
                        <PendingSendFlow reviewedItems={visibleMailItems} />
                    ) : (
                        <>
                            <div className="border-b border-base-300 bg-base-100 px-5 py-4 sm:px-8">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 text-sm text-base-content/60">
                                            <EnvelopeSimpleIcon
                                                aria-hidden="true"
                                                size={18}
                                            />
                                            메일함
                                        </div>
                                        <div className="mt-1 flex items-center gap-3">
                                            <h2 className="text-xl font-semibold">
                                                {activeMailboxTitle}
                                            </h2>
                                            <span className="text-sm text-base-content/55">
                                                {filteredMailItems.length} /{" "}
                                                {visibleMailItems.length}
                                            </span>
                                            {selectedMailIds.size > 0 ? (
                                                <span className="badge badge-primary badge-sm">
                                                    {selectedMailIds.size}개
                                                    선택
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="flex w-full gap-2 sm:w-auto">
                                        <label className="input input-sm flex-1 rounded-full sm:w-64">
                                            <MagnifyingGlassIcon
                                                aria-hidden="true"
                                                size={18}
                                            />
                                            <input
                                                aria-label="메일 검색"
                                                onChange={(event) =>
                                                    setSearchTerm(
                                                        event.currentTarget
                                                            .value
                                                    )
                                                }
                                                placeholder="메일 검색"
                                                type="search"
                                                value={searchTerm}
                                            />
                                        </label>
                                        <div className="relative">
                                            <button
                                                aria-controls="advanced-mail-filter"
                                                aria-expanded={isFilterOpen}
                                                className="btn btn-sm"
                                                onClick={() =>
                                                    setIsFilterOpen(
                                                        !isFilterOpen
                                                    )
                                                }
                                                type="button"
                                            >
                                                <FunnelIcon
                                                    aria-hidden="true"
                                                    size={17}
                                                />
                                                필터
                                            </button>
                                            {isFilterOpen ? (
                                                <div
                                                    id="advanced-mail-filter"
                                                    role="dialog"
                                                    aria-label="고급 필터"
                                                    className="absolute right-0 top-full z-10 mt-2 w-[calc(100vw-2.5rem)] max-w-md border border-base-300 bg-base-200 shadow-sm card"
                                                >
                                                    <div className="card-body grid gap-5 p-5 md:grid-cols-2">
                                                        <div className="col-span-full flex items-center gap-3 border-b border-base-300 pb-3">
                                                            <h3 className="font-semibold">
                                                                기본 필터
                                                            </h3>
                                                            <span className="text-xs text-base-content/55">
                                                                보낸사람과
                                                                수신일
                                                            </span>
                                                        </div>
                                                        <label className="fieldset">
                                                            <span className="label">
                                                                보낸사람
                                                            </span>
                                                            <input
                                                                aria-label="보낸사람"
                                                                className="input input-sm w-full"
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    setSenderFilter(
                                                                        event
                                                                            .currentTarget
                                                                            .value
                                                                    )
                                                                }
                                                                placeholder="별칭 또는 메일 주소"
                                                                type="search"
                                                                value={
                                                                    senderFilter
                                                                }
                                                            />
                                                        </label>
                                                        <fieldset className="fieldset md:col-span-2">
                                                            <legend className="label">
                                                                수신일
                                                            </legend>
                                                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                                                                <input
                                                                    aria-label="수신일 시작일"
                                                                    className="input input-sm w-full min-w-0"
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        setDateFrom(
                                                                            event
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                    type="date"
                                                                    value={
                                                                        dateFrom
                                                                    }
                                                                />
                                                                <span>–</span>
                                                                <input
                                                                    aria-label="수신일 종료일"
                                                                    className="input input-sm w-full min-w-0"
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        setDateTo(
                                                                            event
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                    type="date"
                                                                    value={
                                                                        dateTo
                                                                    }
                                                                />
                                                            </div>
                                                        </fieldset>
                                                        <div className="col-span-full flex items-center gap-3 border-b border-base-300 pb-3 pt-2">
                                                            <h3 className="font-semibold">
                                                                분류
                                                            </h3>
                                                        </div>
                                                        <div className="collapse col-span-full border-b border-base-300 rounded-none">
                                                            <input
                                                                type="checkbox"
                                                                className="peer min-h-0"
                                                            />
                                                            <div className="collapse-title min-h-0 flex items-center gap-3 pt-2 pb-3 font-semibold text-base">
                                                                <h3 className="font-semibold">
                                                                    AI 분류 정보
                                                                </h3>
                                                                <span className="text-xs text-base-content/55 font-normal">
                                                                    분류기가
                                                                    추출한 정보
                                                                </span>
                                                            </div>
                                                            <div className="collapse-content px-0 pb-0">
                                                                <div className="grid gap-5 pt-2 md:grid-cols-2">
                                                                    <label className="fieldset">
                                                                        <span className="label">
                                                                            대상
                                                                        </span>
                                                                        <input
                                                                            aria-label="대상"
                                                                            className="input input-sm w-full"
                                                                            onChange={(
                                                                                event
                                                                            ) =>
                                                                                setAudienceFilter(
                                                                                    event
                                                                                        .currentTarget
                                                                                        .value
                                                                                )
                                                                            }
                                                                            placeholder="예: 대학생"
                                                                            type="search"
                                                                            value={
                                                                                audienceFilter
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <label className="fieldset">
                                                                        <span className="label">
                                                                            일정
                                                                        </span>
                                                                        <input
                                                                            aria-label="일정"
                                                                            className="input input-sm w-full"
                                                                            onChange={(
                                                                                event
                                                                            ) =>
                                                                                setScheduleFilter(
                                                                                    event
                                                                                        .currentTarget
                                                                                        .value
                                                                                )
                                                                            }
                                                                            placeholder="예: 8월 10일"
                                                                            type="search"
                                                                            value={
                                                                                scheduleFilter
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <label className="fieldset">
                                                                        <span className="label">
                                                                            신청
                                                                            마감
                                                                        </span>
                                                                        <input
                                                                            aria-label="신청 마감"
                                                                            className="input input-sm w-full"
                                                                            onChange={(
                                                                                event
                                                                            ) =>
                                                                                setDeadlineFilter(
                                                                                    event
                                                                                        .currentTarget
                                                                                        .value
                                                                                )
                                                                            }
                                                                            type="date"
                                                                            value={
                                                                                deadlineFilter
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <label className="fieldset">
                                                                        <span className="label">
                                                                            혜택
                                                                        </span>
                                                                        <input
                                                                            aria-label="혜택"
                                                                            className="input input-sm w-full"
                                                                            onChange={(
                                                                                event
                                                                            ) =>
                                                                                setBenefitsFilter(
                                                                                    event
                                                                                        .currentTarget
                                                                                        .value
                                                                                )
                                                                            }
                                                                            placeholder="예: 수료증"
                                                                            type="search"
                                                                            value={
                                                                                benefitsFilter
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <label className="fieldset">
                                                                        <span className="label">
                                                                            신청
                                                                            방법
                                                                        </span>
                                                                        <input
                                                                            aria-label="신청 방법"
                                                                            className="input input-sm w-full"
                                                                            onChange={(
                                                                                event
                                                                            ) =>
                                                                                setApplicationMethodFilter(
                                                                                    event
                                                                                        .currentTarget
                                                                                        .value
                                                                                )
                                                                            }
                                                                            placeholder="예: 온라인 신청"
                                                                            type="search"
                                                                            value={
                                                                                applicationMethodFilter
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <label className="fieldset">
                                                                        <span className="label">
                                                                            문의·참고
                                                                        </span>
                                                                        <input
                                                                            aria-label="문의·참고"
                                                                            className="input input-sm w-full"
                                                                            onChange={(
                                                                                event
                                                                            ) =>
                                                                                setContactFilter(
                                                                                    event
                                                                                        .currentTarget
                                                                                        .value
                                                                                )
                                                                            }
                                                                            placeholder="예: 전화번호"
                                                                            type="search"
                                                                            value={
                                                                                contactFilter
                                                                            }
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="fieldset">
                                                                <span className="label">
                                                                    분류
                                                                </span>
                                                                <select
                                                                    aria-label="분류"
                                                                    className="select select-sm w-full"
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        setCategoryFilter(
                                                                            event
                                                                                .currentTarget
                                                                                .value
                                                                        )
                                                                    }
                                                                    value={
                                                                        categoryFilter
                                                                    }
                                                                >
                                                                    <option value="all">
                                                                        전체
                                                                    </option>
                                                                    {distinctCategories.map(
                                                                        (
                                                                            category
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    category
                                                                                }
                                                                                value={
                                                                                    category
                                                                                }
                                                                            >
                                                                                {
                                                                                    category
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </label>
                                                        </div>
                                                        <div className="card-actions mt-1 items-center justify-between border-t border-base-300 pt-4 md:col-span-2">
                                                            <p className="text-sm text-base-content/60">
                                                                검색 결과{" "}
                                                                {
                                                                    filteredMailItems.length
                                                                }
                                                                개
                                                            </p>
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                onClick={() => {
                                                                    setSenderFilter(
                                                                        ""
                                                                    );
                                                                    setDateFrom(
                                                                        ""
                                                                    );
                                                                    setDateTo(
                                                                        ""
                                                                    );
                                                                    setCategoryFilter(
                                                                        "all"
                                                                    );
                                                                    setAudienceFilter(
                                                                        ""
                                                                    );
                                                                    setScheduleFilter(
                                                                        ""
                                                                    );
                                                                    setDeadlineFilter(
                                                                        ""
                                                                    );
                                                                    setBenefitsFilter(
                                                                        ""
                                                                    );
                                                                    setApplicationMethodFilter(
                                                                        ""
                                                                    );
                                                                    setContactFilter(
                                                                        ""
                                                                    );
                                                                }}
                                                                type="button"
                                                            >
                                                                필터 초기화
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                        {showSyncCheck ? (
                                            <span className="text-success font-bold">
                                                ✓
                                            </span>
                                        ) : (
                                            <button
                                                className="btn btn-sm"
                                                disabled={isSyncing}
                                                onClick={() =>
                                                    void handleSync()
                                                }
                                                type="button"
                                            >
                                                {isSyncing ? (
                                                    <span className="loading loading-spinner loading-sm" />
                                                ) : null}
                                                메일 동기화
                                            </button>
                                        )}
                                    </div>
                                    {syncMessage ? (
                                        <div
                                            className={`alert mt-4 ${
                                                syncMessageKind === "error"
                                                    ? "alert-error"
                                                    : "alert-success"
                                            }`}
                                            role="alert"
                                        >
                                            <span>{syncMessage}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-5 py-3 sm:px-8">
                                <label className="flex cursor-pointer items-center gap-3 text-sm">
                                    <input
                                        aria-label="검색 결과 전체 선택"
                                        checked={
                                            filteredMailItems.length > 0 &&
                                            filteredMailItems.every((item) =>
                                                selectedMailIds.has(item.id)
                                            )
                                        }
                                        className="checkbox checkbox-primary checkbox-sm"
                                        onChange={(event) =>
                                            setSelectedMailIds(
                                                event.currentTarget.checked
                                                    ? new Set(
                                                          filteredMailItems.map(
                                                              (item) => item.id
                                                          )
                                                      )
                                                    : new Set()
                                            )
                                        }
                                        type="checkbox"
                                    />
                                    전체 선택
                                </label>
                                {activeMailbox === "review" ? (
                                    <button
                                        className="btn btn-primary btn-sm"
                                        disabled={selectedMailIds.size === 0}
                                        onClick={() => {
                                            setPromotionDraftMessage(
                                                `${selectedMailIds.size}개 메일의 홍보 초안 작성을 시작했습니다.`
                                            );
                                            setSelectedMailIds(new Set());
                                        }}
                                        type="button"
                                    >
                                        홍보 초안 작성
                                    </button>
                                ) : null}
                            </div>

                            {promotionDraftMessage ? (
                                <div className="alert alert-success mx-5 mt-4 text-sm sm:mx-8">
                                    <span>{promotionDraftMessage}</span>
                                </div>
                            ) : null}

                            <div className="divide-y divide-base-300">
                                {filteredMailItems.map((item) => (
                                    <div
                                        className="flex items-stretch gap-3 px-5 py-5 transition hover:bg-base-200 sm:px-8"
                                        key={item.id}
                                    >
                                        <label className="flex cursor-pointer items-start pt-1">
                                            <input
                                                aria-label={`${item.subject} 선택`}
                                                checked={selectedMailIds.has(
                                                    item.id
                                                )}
                                                className="checkbox checkbox-primary checkbox-sm"
                                                onChange={(event) => {
                                                    const nextSelectedMailIds =
                                                        new Set(
                                                            selectedMailIds
                                                        );
                                                    if (
                                                        event.currentTarget
                                                            .checked
                                                    ) {
                                                        nextSelectedMailIds.add(
                                                            item.id
                                                        );
                                                    } else {
                                                        nextSelectedMailIds.delete(
                                                            item.id
                                                        );
                                                    }
                                                    setSelectedMailIds(
                                                        nextSelectedMailIds
                                                    );
                                                }}
                                                type="checkbox"
                                            />
                                        </label>
                                        <button
                                            aria-label={
                                                item.isImportant
                                                    ? "중요 메일 해제"
                                                    : "중요 메일 지정"
                                            }
                                            className={`btn btn-ghost btn-xs ${item.isImportant ? "text-yellow-500" : "text-base-content/30"}`}
                                            onClick={() => {
                                                const id = item.id;
                                                if (flaggingRef.current.has(id))
                                                    return;
                                                flaggingRef.current.add(id);
                                                void fetch(
                                                    `/api/mails/${id}/flag`,
                                                    {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type":
                                                                "application/json",
                                                        },
                                                        body: JSON.stringify({
                                                            important:
                                                                !item.isImportant,
                                                        }),
                                                    }
                                                )
                                                    .then((res) => {
                                                        if (res.ok)
                                                            void refresh();
                                                    })
                                                    .catch(() => {
                                                        /* ignore network errors */
                                                    })
                                                    .finally(() => {
                                                        flaggingRef.current.delete(
                                                            id
                                                        );
                                                    });
                                            }}
                                            type="button"
                                        >
                                            <StarIcon
                                                aria-hidden="true"
                                                size={16}
                                                weight={
                                                    item.isImportant
                                                        ? "fill"
                                                        : "regular"
                                                }
                                            />
                                        </button>
                                        <Link
                                            className="min-w-0 flex-1"
                                            href={
                                                activeMailbox === "review"
                                                    ? `/mails/${item.id}?mode=review`
                                                    : `/mails/${item.id}`
                                            }
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                                        <span className="font-semibold">
                                                            {item.senderName}
                                                        </span>
                                                        <span className="text-base-content/55">
                                                            {item.senderAddress}
                                                        </span>
                                                    </div>
                                                    <h3 className="mt-2 truncate text-lg font-semibold">
                                                        {item.subject}
                                                    </h3>
                                                    <p className="mt-1 truncate text-sm leading-5 text-base-content/60">
                                                        내용 · {item.textBody}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <span className="badge badge-outline badge-sm">
                                                        {statusLabel(
                                                            item.status
                                                        )}
                                                    </span>
                                                    {item.status ===
                                                    "failed" ? (
                                                        <button
                                                            className="btn btn-ghost btn-xs mt-1"
                                                            disabled={retryingRef.current.has(
                                                                item.id
                                                            )}
                                                            onClick={() => {
                                                                void handleRetryAnalysis(
                                                                    item.id
                                                                );
                                                            }}
                                                            type="button"
                                                        >
                                                            {retryingRef.current.has(
                                                                item.id
                                                            )
                                                                ? "재시도 중..."
                                                                : "재분석"}
                                                        </button>
                                                    ) : null}
                                                    <p className="mt-2 text-xs text-base-content/50">
                                                        수신 ·{" "}
                                                        {item.receivedAt
                                                            .toDate()
                                                            .toLocaleString(
                                                                "ko-KR"
                                                            )}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="mt-3 text-xs text-base-content/50">
                                                받는사람 ·{" "}
                                                {item.recipients.join(", ")}
                                            </p>
                                        </Link>
                                    </div>
                                ))}
                                {filteredMailItems.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-base-content/60">
                                        {activeMailbox === "review"
                                            ? "검토 대기 중인 홍보 메일이 없습니다."
                                            : activeMailbox === "sent"
                                              ? "보낸 메일이 없습니다."
                                              : "조건에 맞는 메일이 없습니다."}
                                    </div>
                                ) : null}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
