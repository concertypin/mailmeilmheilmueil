import { useMemo, useState } from "react";
import {
    AddressBookIcon,
    EnvelopeSimpleIcon,
    PaperPlaneRightIcon,
    StarIcon,
    XIcon,
} from "@phosphor-icons/react";
import { Link, useLocation } from "wouter";
import { useMailData } from "@/lib/mail-data";
import { useAddressBook } from "@/lib/contact-book-data";
import type {
    Contact,
    ContactGroup,
    RecipientSelection,
    ResolvedRecipients,
} from "@/lib/contact-book";
import { resolveRecipients } from "@/lib/contact-book";
import {
    encodeImapBasicAuthorization,
    loadImapBasicCredentials,
    redirectForInvalidImapCredentials,
    throwIfUnauthorized,
} from "@/lib/imap-basic";

export default function Compose() {
    const { book, storageWarning } = useAddressBook();
    const { items } = useMailData();
    const [, navigate] = useLocation();

    // ── Recipient selection ──────────────────────────────────────
    const [selections, setSelections] = useState<RecipientSelection[]>([]);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");

    // ── Send state ───────────────────────────────────────────────
    const [isSending, setIsSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [sendSuccess, setSendSuccess] = useState(false);

    const resolved: ResolvedRecipients = useMemo(
        () => resolveRecipients(book, selections),
        [book, selections]
    );

    const canSend =
        !isSending &&
        !sendSuccess &&
        resolved.to.length + resolved.bcc.length > 0 &&
        subject.trim().length > 0 &&
        body.trim().length > 0;

    const addSelection = (sel: RecipientSelection) => {
        setSelections((prev) => [...prev, sel]);
    };

    const removeSelection = (sel: RecipientSelection) => {
        setSelections((prev) =>
            prev.filter((s) => s.kind !== sel.kind || s.id !== sel.id)
        );
    };

    const clearForm = () => {
        setSelections([]);
        setSubject("");
        setBody("");
        setSendSuccess(false);
        setSendError(null);
    };

    const handleSend = async () => {
        const credentials = loadImapBasicCredentials();
        if (!credentials) {
            redirectForInvalidImapCredentials();
            return;
        }

        setIsSending(true);
        setSendError(null);
        setSendSuccess(false);

        try {
            const to = resolved.to.map((c) => c.email);
            const bcc = resolved.bcc.map((c) => c.email);
            const response = await fetch("/api/compose", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    authorization: encodeImapBasicAuthorization(
                        credentials.account,
                        credentials.password
                    ),
                },
                body: JSON.stringify({
                    to: to.length > 0 ? to : undefined,
                    bcc: bcc.length > 0 ? bcc : undefined,
                    subject: subject.trim(),
                    body: body.trim(),
                }),
            });

            if (response.status === 401) {
                throwIfUnauthorized(response);
                return;
            }

            if (!response.ok) {
                throw new Error("메일 발송에 실패했습니다.");
            }

            setSendSuccess(true);
            setTimeout(() => {
                clearForm();
                navigate("/inbox");
            }, 1500);
        } catch (error: unknown) {
            if (error instanceof TypeError) {
                setSendError("네트워크 오류가 발생했습니다.");
            } else if (error instanceof Error) {
                setSendError(error.message);
            } else {
                setSendError("메일 발송에 실패했습니다.");
            }
        } finally {
            setIsSending(false);
        }
    };

    // Build label maps
    const contactLabel = (c: Contact) => `${c.alias} <${c.email}>`;
    const groupLabel = (g: ContactGroup) =>
        `${g.name} (${g.memberIds.length}명)`;

    // Find which contacts/groups are already selected
    const selectedContactIds = new Set(
        selections.filter((s) => s.kind === "contact").map((s) => s.id)
    );
    const selectedGroupIds = new Set(
        selections.filter((s) => s.kind === "group").map((s) => s.id)
    );

    return (
        <div className="min-h-[calc(100vh-4.5rem)] bg-base-200">
            <div className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
                <aside className="border-b border-base-300 bg-base-200 p-3 lg:border-b-0 lg:border-r">
                    <Link
                        className="btn btn-primary btn-sm w-full justify-start"
                        href="/compose"
                    >
                        <PaperPlaneRightIcon
                            aria-hidden="true"
                            size={18}
                            weight="bold"
                        />
                        메일 쓰기
                    </Link>
                    <nav className="mt-5">
                        <ul className="menu w-full gap-1 p-0 text-sm">
                            <li>
                                <Link href="/inbox">
                                    <EnvelopeSimpleIcon
                                        aria-hidden="true"
                                        size={18}
                                    />
                                    받은메일함
                                    <span className="badge badge-sm">
                                        {items
                                            ? items.filter(
                                                  (i) =>
                                                      i.status !== "reviewed" &&
                                                      i.status !== "sent"
                                              ).length
                                            : "—"}
                                    </span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/inbox?folder=important">
                                    <StarIcon aria-hidden="true" size={18} />
                                    중요 메일
                                    <span className="badge badge-sm">1</span>
                                </Link>
                            </li>
                        </ul>
                    </nav>
                    <div className="mt-7 border-t border-base-300 pt-5">
                        <p className="px-3 text-xs font-semibold tracking-wide text-base-content/50">
                            검토함
                        </p>
                        <ul className="menu mt-2 w-full gap-1 p-0 text-sm">
                            <li>
                                <Link
                                    className="h-auto py-2"
                                    href="/inbox?folder=review"
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
                                        {items
                                            ? items.filter(
                                                  (i) =>
                                                      i.status === "ready" &&
                                                      i.analysis !== null
                                              ).length
                                            : "—"}
                                    </span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/inbox?folder=outbox">
                                    발송 대기
                                    <span className="badge badge-sm">
                                        {items
                                            ? items.filter(
                                                  (i) => i.status === "reviewed"
                                              ).length
                                            : "—"}
                                    </span>
                                </Link>
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

                <main className="bg-base-100 px-5 py-8 sm:px-8 lg:px-10">
                    <div className="mx-auto max-w-4xl">
                        {storageWarning ? (
                            <div
                                className="alert alert-warning mb-5"
                                role="alert"
                            >
                                <span>
                                    로컬 저장소를 사용할 수 없어 연락처가
                                    일시적으로만 저장됩니다.
                                </span>
                            </div>
                        ) : null}

                        {/* ── Recipient picker ──────────────────────── */}
                        <section className="card border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <h2 className="card-title">수신자 선택</h2>

                                {/* Selected chips */}
                                {selections.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selections.map((sel) => {
                                            const item =
                                                sel.kind === "contact"
                                                    ? book.contacts.find(
                                                          (c) => c.id === sel.id
                                                      )
                                                    : book.groups.find(
                                                          (g) => g.id === sel.id
                                                      );
                                            if (!item) return null;
                                            const label =
                                                sel.kind === "contact"
                                                    ? contactLabel(
                                                          item as Contact
                                                      )
                                                    : groupLabel(
                                                          item as ContactGroup
                                                      );
                                            return (
                                                <span
                                                    className="badge badge-lg gap-1 pr-0"
                                                    key={sel.kind + sel.id}
                                                >
                                                    <span className="text-xs text-base-content/50">
                                                        {sel.kind === "contact"
                                                            ? "연락처"
                                                            : "그룹"}
                                                    </span>
                                                    {label}
                                                    <button
                                                        aria-label={`${label} 제거`}
                                                        className="btn btn-ghost btn-xs"
                                                        onClick={() =>
                                                            removeSelection(sel)
                                                        }
                                                        type="button"
                                                    >
                                                        <XIcon
                                                            aria-hidden="true"
                                                            size={14}
                                                        />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-base-content/50">
                                        연락처나 그룹을 선택해주세요.
                                    </p>
                                )}

                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                    {/* Contacts */}
                                    {book.contacts.length > 0 ? (
                                        <fieldset>
                                            <legend className="mb-2 text-sm font-medium text-base-content/70">
                                                연락처
                                            </legend>
                                            <div className="max-h-48 space-y-1 overflow-y-auto">
                                                {book.contacts.map((c) => (
                                                    <button
                                                        className={`btn btn-sm w-full justify-start text-left ${selectedContactIds.has(c.id) ? "btn-neutral" : "btn-ghost"}`}
                                                        disabled={selectedContactIds.has(
                                                            c.id
                                                        )}
                                                        key={c.id}
                                                        onClick={() =>
                                                            addSelection({
                                                                kind: "contact",
                                                                id: c.id,
                                                            })
                                                        }
                                                        type="button"
                                                    >
                                                        {contactLabel(c)}
                                                    </button>
                                                ))}
                                            </div>
                                        </fieldset>
                                    ) : (
                                        <p className="text-sm text-base-content/50">
                                            등록된 연락처가 없습니다.
                                        </p>
                                    )}

                                    {/* Groups */}
                                    {book.groups.length > 0 ? (
                                        <fieldset>
                                            <legend className="mb-2 text-sm font-medium text-base-content/70">
                                                그룹
                                            </legend>
                                            <div className="max-h-48 space-y-1 overflow-y-auto">
                                                {book.groups.map((g) => (
                                                    <button
                                                        className={`btn btn-sm w-full justify-start text-left ${selectedGroupIds.has(g.id) ? "btn-neutral" : "btn-ghost"}`}
                                                        disabled={selectedGroupIds.has(
                                                            g.id
                                                        )}
                                                        key={g.id}
                                                        onClick={() =>
                                                            addSelection({
                                                                kind: "group",
                                                                id: g.id,
                                                            })
                                                        }
                                                        type="button"
                                                    >
                                                        {groupLabel(g)}
                                                    </button>
                                                ))}
                                            </div>
                                        </fieldset>
                                    ) : null}
                                </div>
                            </div>
                        </section>

                        {/* ── Resolved recipients ──────────────────── */}
                        <section className="card mt-5 border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <h2 className="card-title">수신 미리보기</h2>
                                <div className="mt-2 space-y-2 text-sm">
                                    {resolved.to.length > 0 ? (
                                        <div>
                                            <span className="font-medium text-base-content/70">
                                                받는 사람 (To)
                                            </span>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {resolved.to.map((c, i) => (
                                                    <span
                                                        className="badge badge-ghost badge-sm"
                                                        key={`${c.id}-to-${i}`}
                                                    >
                                                        {contactLabel(c)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {resolved.bcc.length > 0 ? (
                                        <div>
                                            <span className="font-medium text-base-content/70">
                                                숨은 참조 (Bcc)
                                                <span className="ml-1 text-xs text-base-content/50">
                                                    {resolved.bcc.length}명
                                                </span>
                                            </span>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {resolved.bcc.map((c, i) => (
                                                    <span
                                                        className="badge badge-ghost badge-sm"
                                                        key={`${c.id}-bcc-${i}`}
                                                    >
                                                        {contactLabel(c)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {resolved.to.length === 0 &&
                                    resolved.bcc.length === 0 ? (
                                        <p className="text-base-content/50">
                                            수신자를 선택하면 여기에 표시됩니다.
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </section>

                        {/* ── Draft fields ─────────────────────────── */}
                        <section className="card mt-5 border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body space-y-4">
                                <label className="fieldset">
                                    <span className="label">제목</span>
                                    <input
                                        className="input w-full"
                                        onChange={(event) => {
                                            setSubject(
                                                event.currentTarget.value
                                            );
                                        }}
                                        placeholder="메일 제목을 입력해주세요."
                                        value={subject}
                                    />
                                </label>
                                <label className="fieldset">
                                    <span className="label">내용</span>
                                    <textarea
                                        className="textarea textarea-bordered h-48 w-full"
                                        onChange={(event) => {
                                            setBody(event.currentTarget.value);
                                        }}
                                        placeholder="메일 내용을 입력해주세요."
                                        value={body}
                                    />
                                </label>
                            </div>
                        </section>

                        {/* ── Send button ─────────────────────────── */}
                        <div className="mt-6 flex flex-col gap-3">
                            {sendError ? (
                                <div className="alert alert-error" role="alert">
                                    <span>{sendError}</span>
                                </div>
                            ) : null}
                            {sendSuccess ? (
                                <div
                                    className="alert alert-success"
                                    role="alert"
                                >
                                    <span>메일이 발송되었습니다.</span>
                                </div>
                            ) : null}
                            <div className="flex items-start gap-4">
                                <button
                                    className="btn btn-primary"
                                    disabled={!canSend}
                                    onClick={() => {
                                        void handleSend();
                                    }}
                                    type="button"
                                >
                                    {isSending ? (
                                        <>
                                            <span className="loading loading-spinner loading-sm" />
                                            발송 중...
                                        </>
                                    ) : (
                                        <>
                                            <PaperPlaneRightIcon
                                                aria-hidden="true"
                                                size={18}
                                                weight="bold"
                                            />
                                            발송
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
