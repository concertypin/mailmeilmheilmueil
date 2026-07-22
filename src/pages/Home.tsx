import { useState } from "react";
import {
    AddressBookIcon,
    FunnelIcon,
    EnvelopeSimpleIcon,
    MagnifyingGlassIcon,
    PencilSimpleIcon,
    StarIcon,
} from "@phosphor-icons/react";
import { Link, useSearchParams } from "wouter";
import { mockMailItems } from "@/lib/mock-mail";
import type { MailItem } from "@/lib/mail-schema";
import { useMailWorkspace } from "@/lib/mail-workspace";

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

const INITIAL_IMPORTANT_MAIL_IDS: Readonly<Record<string, true>> = {
    "welcome-mail": true,
};

export default function Home() {
    const [selectedMailIds, setSelectedMailIds] = useState<Set<string>>(
        new Set()
    );
    const [searchTerm, setSearchTerm] = useState("");
    const [senderFilter, setSenderFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [promotionDraftFilter, setPromotionDraftFilter] = useState("all");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [promotionDraftMessage, setPromotionDraftMessage] = useState<
        string | null
    >(null);
    const [searchParams] = useSearchParams();
    const [activeMailbox, setActiveMailbox] = useState<
        "inbox" | "important" | "review" | "outbox"
    >(() => {
        const folder = searchParams.get("folder");
        return folder === "important" ||
            folder === "review" ||
            folder === "outbox"
            ? folder
            : "inbox";
    });
    const { reviewedMailIds } = useMailWorkspace();
    const visibleMailItems = mockMailItems.filter((item) => {
        if (activeMailbox === "review") {
            return !reviewedMailIds.has(item.id) && item.analysis !== null;
        }
        if (activeMailbox === "outbox") {
            return reviewedMailIds.has(item.id);
        }
        if (activeMailbox === "important") {
            return INITIAL_IMPORTANT_MAIL_IDS[item.id] === true;
        }
        return !reviewedMailIds.has(item.id);
    });
    const activeMailboxTitle =
        activeMailbox === "inbox"
            ? "받은메일함"
            : activeMailbox === "important"
              ? "중요 메일"
              : activeMailbox === "review"
                ? "홍보 메일 검토"
                : "발송대기함";
    const filteredMailItems = visibleMailItems.filter((item) => {
        const receivedDate = item.receivedAt
            .toDate()
            .toLocaleDateString("sv-SE");
        const searchableText =
            `${item.senderName} ${item.senderAddress} ${item.subject} ${item.textBody}`.toLowerCase();
        const matchesSearch = searchableText.includes(
            searchTerm.trim().toLowerCase()
        );
        const matchesSender = item.senderName
            .toLowerCase()
            .includes(senderFilter.trim().toLowerCase());
        const matchesDateFrom = dateFrom === "" || receivedDate >= dateFrom;
        const matchesDateTo = dateTo === "" || receivedDate <= dateTo;
        const hasPromotionDraft =
            item.analysis?.promotionDraft !== null &&
            item.analysis?.promotionDraft !== undefined;
        const matchesPromotionDraft =
            promotionDraftFilter === "all" ||
            (promotionDraftFilter === "ready"
                ? hasPromotionDraft
                : !hasPromotionDraft);

        return (
            matchesSearch &&
            matchesSender &&
            matchesDateFrom &&
            matchesDateTo &&
            matchesPromotionDraft
        );
    });

    return (
        <div className="min-h-[calc(100vh-4.5rem)] bg-base-200">
            <div className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
                <aside className="border-b border-base-300 bg-base-200 p-3 lg:border-b-0 lg:border-r">
                    <button
                        className="btn btn-primary btn-sm w-full justify-start"
                        type="button"
                    >
                        <PencilSimpleIcon
                            aria-hidden="true"
                            size={18}
                            weight="bold"
                        />
                        메일 쓰기
                    </button>

                    <nav className="mt-5">
                        <ul className="menu w-full gap-1 p-0 text-sm">
                            <li>
                                <button
                                    className={
                                        activeMailbox === "inbox"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => setActiveMailbox("inbox")}
                                    type="button"
                                >
                                    <EnvelopeSimpleIcon
                                        aria-hidden="true"
                                        size={18}
                                    />
                                    받은메일함
                                    <span className="badge badge-sm">
                                        {mockMailItems.length}
                                    </span>
                                </button>
                            </li>
                            <li>
                                <button
                                    className={
                                        activeMailbox === "important"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() =>
                                        setActiveMailbox("important")
                                    }
                                    type="button"
                                >
                                    <StarIcon aria-hidden="true" size={18} />
                                    중요 메일
                                    <span className="badge badge-sm">
                                        {
                                            Object.keys(
                                                INITIAL_IMPORTANT_MAIL_IDS
                                            ).length
                                        }
                                    </span>
                                </button>
                            </li>
                        </ul>
                    </nav>
                    <div className="mt-7 border-t border-base-300 pt-5">
                        <p className="px-3 text-xs font-semibold tracking-wide text-base-content/50">
                            검토함
                        </p>
                        <ul className="menu mt-2 w-full gap-1 p-0 text-sm">
                            <li>
                                <button
                                    className={`h-auto py-2 ${activeMailbox === "review" ? "active" : ""}`}
                                    onClick={() => setActiveMailbox("review")}
                                    type="button"
                                >
                                    <span className="text-left">
                                        <span className="block">
                                            홍보 메일 검토
                                        </span>
                                        <span className="mt-0.5 block text-xs font-normal text-base-content/55">
                                            홍보 초안 검토 대기함
                                        </span>
                                    </span>
                                    <span className="badge badge-primary badge-sm">
                                        {
                                            mockMailItems.filter(
                                                (item) =>
                                                    !reviewedMailIds.has(
                                                        item.id
                                                    ) && item.analysis !== null
                                            ).length
                                        }
                                    </span>
                                </button>
                            </li>
                            <li>
                                <button
                                    className={
                                        activeMailbox === "outbox"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => setActiveMailbox("outbox")}
                                    type="button"
                                >
                                    발송 대기
                                    <span className="badge badge-sm">
                                        {reviewedMailIds.size}
                                    </span>
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div className="mt-7 border-t border-base-300 pt-5">
                        <Link
                            className="btn btn-ghost btn-sm w-full justify-start"
                            href="/contacts"
                        >
                            <AddressBookIcon aria-hidden="true" size={18} />
                            연락처 관리
                        </Link>
                    </div>
                </aside>

                <section className="bg-base-100">
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
                                            {selectedMailIds.size}개 선택
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
                                                event.currentTarget.value
                                            )
                                        }
                                        placeholder="메일 검색"
                                        type="search"
                                        value={searchTerm}
                                    />
                                </label>
                                <button
                                    aria-expanded={isFilterOpen}
                                    className="btn btn-sm"
                                    onClick={() =>
                                        setIsFilterOpen(!isFilterOpen)
                                    }
                                    type="button"
                                >
                                    <FunnelIcon aria-hidden="true" size={17} />
                                    필터
                                </button>
                            </div>
                        </div>

                        {isFilterOpen ? (
                            <div className="card mt-4 border border-base-300 bg-base-200 shadow-sm">
                                <div className="card-body grid gap-4 p-5 md:grid-cols-3">
                                    <label className="fieldset">
                                        <span className="label">보낸사람</span>
                                        <input
                                            className="input w-full"
                                            onChange={(event) =>
                                                setSenderFilter(
                                                    event.currentTarget.value
                                                )
                                            }
                                            placeholder="별칭 또는 메일 주소"
                                            type="search"
                                            value={senderFilter}
                                        />
                                    </label>
                                    <fieldset className="fieldset">
                                        <legend className="label">기간</legend>
                                        <div className="flex items-center gap-2">
                                            <input
                                                aria-label="시작일"
                                                className="input min-w-0 flex-1"
                                                onChange={(event) =>
                                                    setDateFrom(
                                                        event.currentTarget
                                                            .value
                                                    )
                                                }
                                                type="date"
                                                value={dateFrom}
                                            />
                                            <span>–</span>
                                            <input
                                                aria-label="종료일"
                                                className="input min-w-0 flex-1"
                                                onChange={(event) =>
                                                    setDateTo(
                                                        event.currentTarget
                                                            .value
                                                    )
                                                }
                                                type="date"
                                                value={dateTo}
                                            />
                                        </div>
                                    </fieldset>
                                    <label className="fieldset">
                                        <span className="label">
                                            홍보 초안 작성 상태
                                        </span>
                                        <select
                                            className="select w-full"
                                            onChange={(event) =>
                                                setPromotionDraftFilter(
                                                    event.currentTarget.value
                                                )
                                            }
                                            value={promotionDraftFilter}
                                        >
                                            <option value="all">전체</option>
                                            <option value="ready">
                                                작성 완료
                                            </option>
                                            <option value="missing">
                                                미작성
                                            </option>
                                        </select>
                                    </label>
                                    <div className="card-actions col-span-full mt-1 items-center justify-between">
                                        <p className="text-sm text-base-content/60">
                                            검색 결과 {filteredMailItems.length}
                                            개
                                        </p>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => {
                                                setSenderFilter("");
                                                setDateFrom("");
                                                setDateTo("");
                                                setPromotionDraftFilter("all");
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
                                        checked={selectedMailIds.has(item.id)}
                                        className="checkbox checkbox-primary checkbox-sm"
                                        onChange={(event) => {
                                            const nextSelectedMailIds = new Set(
                                                selectedMailIds
                                            );
                                            if (event.currentTarget.checked) {
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
                                                {activeMailbox === "outbox"
                                                    ? "발송 대기"
                                                    : statusLabel(item.status)}
                                            </span>
                                            <p className="mt-2 text-xs text-base-content/50">
                                                수신 ·{" "}
                                                {item.receivedAt
                                                    .toDate()
                                                    .toLocaleString("ko-KR")}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs text-base-content/50">
                                        받는사람 · {item.recipients.join(", ")}
                                    </p>
                                </Link>
                            </div>
                        ))}
                        {filteredMailItems.length === 0 ? (
                            <div className="p-8 text-center text-sm text-base-content/60">
                                {activeMailbox === "review"
                                    ? "검토 대기 중인 홍보 메일이 없습니다."
                                    : activeMailbox === "outbox"
                                      ? "발송 대기 중인 메일이 없습니다."
                                      : "조건에 맞는 메일이 없습니다."}
                            </div>
                        ) : null}
                    </div>
                </section>
            </div>
        </div>
    );
}
