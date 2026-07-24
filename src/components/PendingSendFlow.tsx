import { useState } from "react";
import { Link } from "wouter";
import type { MailItem } from "@/lib/mail-schema";
import { useAddressBook } from "@/lib/contact-book-data";
import { resolveRecipients } from "@/lib/contact-book";
import { useMailData } from "@/lib/mail-data";
import {
    encodeImapBasicAuthorization,
    loadImapBasicCredentials,
    redirectForInvalidImapCredentials,
} from "@/lib/imap-basic";

type FlowStep = "group" | "draft" | "confirm";

interface PendingSendFlowProps {
    reviewedItems: readonly MailItem[];
}

export default function PendingSendFlow({
    reviewedItems,
}: PendingSendFlowProps) {
    const { book } = useAddressBook();
    const { sendReviewed } = useMailData();
    const [step, setStep] = useState<FlowStep>("group");
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [sendSuccess, setSendSuccess] = useState(false);

    const eligibleDrafts = reviewedItems.filter((item) => item.draft);

    const handleGroupSelect = (groupId: string) => {
        setSelectedGroupId(groupId);
        setStep("draft");
        setSendError(null);
    };

    const handleDraftSelect = (draftId: string) => {
        setSelectedDraftId(draftId);
        setStep("confirm");
        setSendError(null);
    };

    const handleResetGroup = () => {
        setSelectedGroupId(null);
        setSelectedDraftId(null);
        setStep("group");
        setSendError(null);
        setSendSuccess(false);
    };

    const handleSend = async () => {
        const credentials = loadImapBasicCredentials();
        if (!credentials) {
            redirectForInvalidImapCredentials();
            return;
        }
        if (!selectedGroupId || !selectedDraftId) return;

        const group = book.groups.find((g) => g.id === selectedGroupId);
        if (!group) return;

        const resolved = resolveRecipients(book, [
            { kind: "group", id: selectedGroupId },
        ]);
        const bcc = resolved.bcc.map((c) => c.email);
        if (bcc.length === 0) return;

        const draft = reviewedItems.find((i) => i.id === selectedDraftId);
        if (!draft) return;

        setSending(true);
        setSendError(null);
        try {
            const auth = encodeImapBasicAuthorization(
                credentials.account,
                credentials.password
            );
            await sendReviewed(draft, bcc, auth);
            setSendSuccess(true);
            setSelectedGroupId(null);
            setSelectedDraftId(null);
            setStep("group");
        } catch (err: unknown) {
            setSendError(
                err instanceof Error ? err.message : "발송에 실패했습니다."
            );
        } finally {
            setSending(false);
        }
    };

    if (sendSuccess) {
        return (
            <div className="p-8">
                <div className="alert alert-success" role="alert">
                    <span>메일이 발송되었습니다.</span>
                </div>
                <button
                    className="btn btn-sm mt-4"
                    onClick={() => setSendSuccess(false)}
                    type="button"
                >
                    계속 발송
                </button>
            </div>
        );
    }

    if (step === "group") {
        return (
            <div className="p-8">
                {book.groups.length === 0 ? (
                    <div className="text-sm text-base-content/60">
                        <p>등록된 그룹이 없습니다.</p>
                        <Link
                            className="btn btn-primary btn-sm mt-4"
                            href="/contacts"
                        >
                            그룹 만들기
                        </Link>
                    </div>
                ) : (
                    <>
                        <h3 className="mb-4 font-semibold">
                            받는 사람 그룹 선택
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {book.groups.map((group) => (
                                <button
                                    className={`card border p-4 text-left transition hover:shadow-md ${
                                        selectedGroupId === group.id
                                            ? "border-secondary bg-secondary/10"
                                            : "border-base-300"
                                    }`}
                                    key={group.id}
                                    onClick={() => handleGroupSelect(group.id)}
                                    type="button"
                                >
                                    <div className="card-body p-0">
                                        <h4 className="font-medium">
                                            {group.name}
                                        </h4>
                                        <p className="text-sm text-base-content/60">
                                            {group.memberIds.length}명
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    if (step === "draft") {
        return (
            <div className="p-8">
                <div className="mb-4 flex items-center gap-3">
                    <h3 className="font-semibold">발송할 홍보 초안 선택</h3>
                    <button
                        className="btn btn-ghost btn-xs"
                        onClick={handleResetGroup}
                        type="button"
                    >
                        다른 그룹 선택
                    </button>
                </div>
                {eligibleDrafts.length === 0 ? (
                    <div className="text-sm text-base-content/60">
                        <p>발송할 수 있는 홍보 초안이 없습니다.</p>
                        <button
                            className="btn btn-ghost btn-sm mt-4"
                            onClick={handleResetGroup}
                            type="button"
                        >
                            다른 그룹 선택
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {eligibleDrafts.map((item) => (
                            <button
                                className={`card border p-4 text-left transition hover:shadow-md ${
                                    selectedDraftId === item.id
                                        ? "border-secondary bg-secondary/10"
                                        : "border-base-300"
                                }`}
                                key={item.id}
                                onClick={() => handleDraftSelect(item.id)}
                                type="button"
                            >
                                <div className="card-body p-0">
                                    <h4 className="font-medium line-clamp-2">
                                        {item.subject}
                                    </h4>
                                    <p className="mt-2 line-clamp-3 text-sm text-base-content/60">
                                        {item.draft}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const selectedGroup = book.groups.find((g) => g.id === selectedGroupId);
    const selectedDraft = reviewedItems.find((i) => i.id === selectedDraftId);
    const resolved = selectedGroupId
        ? resolveRecipients(book, [{ kind: "group", id: selectedGroupId }])
        : null;
    const bccCount = resolved?.bcc.length ?? 0;

    return (
        <div className="p-8">
            <div className="mb-6">
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                        setSelectedDraftId(null);
                        setStep("draft");
                    }}
                    type="button"
                >
                    ← 뒤로
                </button>
            </div>
            <div className="card border border-base-300">
                <div className="card-body">
                    <h3 className="card-title">발송 확인</h3>
                    <dl className="grid gap-4 text-sm">
                        <div>
                            <dt className="text-base-content/55">
                                받는 사람 그룹
                            </dt>
                            <dd className="font-medium">
                                {selectedGroup?.name}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-base-content/55">수신자 수</dt>
                            <dd className="font-medium">{bccCount}명</dd>
                        </div>
                        <div>
                            <dt className="text-base-content/55">제목</dt>
                            <dd className="font-medium">
                                {selectedDraft?.subject}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-base-content/55">발송 내용</dt>
                            <dd className="whitespace-pre-wrap text-base-content/80">
                                {selectedDraft?.draft}
                            </dd>
                        </div>
                    </dl>
                    <div className="mt-6">
                        <button
                            className="btn btn-primary"
                            disabled={bccCount === 0 || sending}
                            onClick={() => void handleSend()}
                            type="button"
                        >
                            {sending ? (
                                <span className="loading loading-spinner loading-sm" />
                            ) : null}
                            발송
                        </button>
                        {sendError ? (
                            <div
                                className="alert alert-error mt-4"
                                role="alert"
                            >
                                <span>{sendError}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
