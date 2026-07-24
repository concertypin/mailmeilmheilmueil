import {
    AddressBookIcon,
    EnvelopeSimpleIcon,
    GaugeIcon,
    PencilSimpleIcon,
    StarIcon,
} from "@phosphor-icons/react";
import { Link } from "wouter";
import type { MailItem } from "@/lib/mail-schema";

type Mailbox = "inbox" | "important" | "review" | "outbox" | "sent";
type ActivePage = "dashboard" | "compose" | "contacts" | "inbox";

interface MailSidebarProps {
    items: MailItem[] | null;
    activePage: ActivePage;
    activeMailbox?: Mailbox;
    onMailboxChange?: (mailbox: Mailbox) => void;
}

const mailboxLabels: Record<Mailbox, string> = {
    inbox: "받은메일함",
    important: "중요 메일",
    review: "홍보 메일 검토",
    outbox: "발송 대기",
    sent: "보낸메일함",
};

const mailboxPaths: Record<Mailbox, string> = {
    inbox: "/inbox",
    important: "/inbox?folder=important",
    review: "/inbox?folder=review",
    outbox: "/inbox?folder=outbox",
    sent: "/inbox?folder=sent",
};

export default function MailSidebar({
    items,
    activePage,
    activeMailbox,
    onMailboxChange,
}: MailSidebarProps) {
    const useMailboxButtons = onMailboxChange !== undefined;
    const mailboxCount = (mailbox: Mailbox) => {
        if (!items) return "—";
        if (mailbox === "inbox") {
            return items.filter(
                (item) => item.status !== "reviewed" && item.status !== "sent"
            ).length;
        }
        if (mailbox === "important") {
            return items.filter((item) => item.isImportant === true).length;
        }
        if (mailbox === "review") {
            return items.filter(
                (item) => item.status === "ready" && item.analysis !== null
            ).length;
        }
        if (mailbox === "outbox") {
            return items.filter((item) => item.status === "reviewed").length;
        }
        return items.filter((item) => item.status === "sent").length;
    };

    const mailboxAction = (mailbox: Mailbox) => {
        const content = (
            <>
                {mailbox === "inbox" ? (
                    <EnvelopeSimpleIcon aria-hidden="true" size={18} />
                ) : mailbox === "important" ? (
                    <StarIcon aria-hidden="true" size={18} />
                ) : null}
                {mailbox === "review" ? (
                    <span className="text-left">
                        <span className="block">{mailboxLabels[mailbox]}</span>
                        <span className="mt-0.5 block text-xs font-normal text-base-content/55">
                            홍보 초안 검토 대기함
                        </span>
                    </span>
                ) : (
                    mailboxLabels[mailbox]
                )}
                <span
                    className={
                        mailbox === "review"
                            ? "badge badge-primary badge-sm"
                            : "badge badge-sm"
                    }
                >
                    {mailboxCount(mailbox)}
                </span>
            </>
        );

        if (useMailboxButtons) {
            return (
                <button
                    className={activeMailbox === mailbox ? "active" : ""}
                    onClick={() => onMailboxChange(mailbox)}
                    type="button"
                >
                    {content}
                </button>
            );
        }

        return (
            <Link
                className={
                    activePage === "inbox" && activeMailbox === mailbox
                        ? "active"
                        : ""
                }
                href={mailboxPaths[mailbox]}
            >
                {content}
            </Link>
        );
    };

    return (
        <aside className="border-b border-base-300 bg-base-200 p-3 lg:border-b-0 lg:border-r">
            <Link
                className={`btn btn-primary btn-sm w-full justify-start ${activePage === "compose" ? "active" : ""}`}
                href="/compose"
            >
                <PencilSimpleIcon aria-hidden="true" size={18} weight="bold" />
                메일 쓰기
            </Link>

            <nav className="mt-5">
                <ul className="menu w-full gap-1 p-0 text-sm">
                    <li>
                        <Link
                            className={
                                activePage === "dashboard" ? "active" : ""
                            }
                            href="/dashboard"
                        >
                            <GaugeIcon aria-hidden="true" size={18} />
                            대시보드
                        </Link>
                    </li>
                    <li>{mailboxAction("inbox")}</li>
                    <li>{mailboxAction("important")}</li>
                </ul>
            </nav>

            <div className="mt-7 border-t border-base-300 pt-5">
                <p className="px-3 text-xs font-semibold tracking-wide text-base-content/50">
                    검토함
                </p>
                <ul className="menu mt-2 w-full gap-1 p-0 text-sm">
                    <li>{mailboxAction("review")}</li>
                    <li>{mailboxAction("outbox")}</li>
                    <li>{mailboxAction("sent")}</li>
                </ul>
            </div>

            <div className="mt-7 border-t border-base-300 pt-5">
                <Link
                    className={`btn btn-ghost btn-sm w-full justify-start ${activePage === "contacts" ? "active" : ""}`}
                    href="/contacts"
                >
                    <AddressBookIcon aria-hidden="true" size={18} />
                    연락처 관리
                </Link>
            </div>
        </aside>
    );
}
