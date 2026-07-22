import { useRef, useState } from "react";
import {
    AddressBookIcon,
    EnvelopeSimpleIcon,
    PencilSimpleIcon,
    PlusIcon,
    StarIcon,
    TrashIcon,
} from "@phosphor-icons/react";
import { Link } from "wouter";
import { mockMailItems } from "@/lib/mock-mail";
import { useMailWorkspace } from "@/lib/mail-workspace";

type Contact = {
    id: string;
    name: string;
    email: string;
};

const initialContacts: Contact[] = [
    {
        id: "promotion-team",
        name: "학생 홍보팀",
        email: "promotion@example.com",
    },
    {
        id: "student-support",
        name: "학생지원팀",
        email: "student-support@example.com",
    },
];

export default function Contacts() {
    const [contacts, setContacts] = useState(initialContacts);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const nextContactId = useRef(initialContacts.length);
    const { reviewedMailIds } = useMailWorkspace();
    const reviewCount = mockMailItems.filter(
        (item) => !reviewedMailIds.has(item.id) && item.analysis !== null
    ).length;

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
                                <Link href="/inbox">
                                    <EnvelopeSimpleIcon
                                        aria-hidden="true"
                                        size={18}
                                    />
                                    받은메일함
                                    <span className="badge badge-sm">
                                        {mockMailItems.length}
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
                                        {reviewCount}
                                    </span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/inbox?folder=outbox">
                                    발송 대기
                                    <span className="badge badge-sm">
                                        {reviewedMailIds.size}
                                    </span>
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="mt-7 border-t border-base-300 pt-5">
                        <Link
                            className="btn btn-ghost btn-sm w-full justify-start active"
                            href="/contacts"
                        >
                            <AddressBookIcon aria-hidden="true" size={18} />
                            연락처 관리
                        </Link>
                    </div>
                </aside>

                <main className="bg-base-100 px-5 py-8 sm:px-8 lg:px-10">
                    <div className="mx-auto max-w-5xl">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <AddressBookIcon
                                        aria-hidden="true"
                                        size={28}
                                        weight="duotone"
                                    />
                                    <h1 className="text-3xl font-semibold">
                                        연락처 관리
                                    </h1>
                                </div>
                                <p className="mt-2 text-base-content/60">
                                    홍보 메일을 보낼 수신 대상을 관리합니다.
                                </p>
                            </div>
                            <span className="badge badge-lg">
                                {contacts.length}명
                            </span>
                        </div>

                        <section className="card mt-8 border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <h2 className="card-title">연락처 추가</h2>
                                <form
                                    className="mt-2 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        if (
                                            name.trim().length === 0 ||
                                            email.trim().length === 0
                                        ) {
                                            return;
                                        }
                                        setContacts([
                                            ...contacts,
                                            {
                                                id: `${email.trim()}-${nextContactId.current++}`,
                                                name: name.trim(),
                                                email: email.trim(),
                                            },
                                        ]);
                                        setName("");
                                        setEmail("");
                                    }}
                                >
                                    <input
                                        className="input w-full"
                                        onChange={(event) =>
                                            setName(event.currentTarget.value)
                                        }
                                        placeholder="이름 또는 그룹명"
                                        value={name}
                                    />
                                    <input
                                        className="input w-full"
                                        onChange={(event) =>
                                            setEmail(event.currentTarget.value)
                                        }
                                        placeholder="email@example.com"
                                        type="email"
                                        value={email}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        disabled={
                                            name.trim().length === 0 ||
                                            email.trim().length === 0
                                        }
                                        type="submit"
                                    >
                                        <PlusIcon
                                            aria-hidden="true"
                                            size={18}
                                        />
                                        추가
                                    </button>
                                </form>
                            </div>
                        </section>

                        <section className="card mt-5 border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body p-0">
                                <div className="border-b border-base-300 px-6 py-5">
                                    <h2 className="text-lg font-semibold">
                                        수신 대상 목록
                                    </h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra">
                                        <thead>
                                            <tr>
                                                <th>이름</th>
                                                <th>이메일</th>
                                                <th aria-label="작업" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {contacts.map((contact) => (
                                                <tr key={contact.id}>
                                                    <td className="font-medium">
                                                        {contact.name}
                                                    </td>
                                                    <td>{contact.email}</td>
                                                    <td className="text-right">
                                                        <button
                                                            aria-label={`${contact.name} 삭제`}
                                                            className="btn btn-ghost btn-sm text-error"
                                                            onClick={() =>
                                                                setContacts(
                                                                    contacts.filter(
                                                                        (
                                                                            item
                                                                        ) =>
                                                                            item.id !==
                                                                            contact.id
                                                                    )
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            <TrashIcon
                                                                aria-hidden="true"
                                                                size={18}
                                                            />
                                                            삭제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
