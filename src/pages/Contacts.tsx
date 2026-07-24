import { useRef, useState } from "react";
import {
    AddressBookIcon,
    PencilSimpleIcon,
    PlusIcon,
    TrashIcon,
    XIcon,
} from "@phosphor-icons/react";
import { useMailData } from "@/lib/mail-data";
import MailSidebar from "@/components/MailSidebar";
import { useAddressBook } from "@/lib/contact-book-data";
import type {
    Contact,
    ContactBookMutationResult,
    ContactGroup,
} from "@/lib/contact-book";

export default function Contacts() {
    const {
        book,
        storageWarning,
        addContact,
        updateContact,
        removeContact,
        addGroup,
        updateGroup,
        removeGroup,
    } = useAddressBook();
    const { items } = useMailData();

    // ── Contact form ─────────────────────────────────────────────
    const [alias, setAlias] = useState("");
    const [email, setEmail] = useState("");
    const [contactFeedback, setContactFeedback] = useState<string | null>(null);
    const aliasRef = useRef<HTMLInputElement>(null);

    // ── Edit contact modal ────────────────────────────────────────
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editAlias, setEditAlias] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editContactFeedback, setEditContactFeedback] = useState<
        string | null
    >(null);

    // ── Group form ────────────────────────────────────────────────
    const [groupName, setGroupName] = useState("");
    const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
    const [groupFeedback, setGroupFeedback] = useState<string | null>(null);

    // ── Edit group modal ──────────────────────────────────────────
    const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
    const [editGroupName, setEditGroupName] = useState("");
    const [editGroupMemberIds, setEditGroupMemberIds] = useState<string[]>([]);
    const [editGroupFeedback, setEditGroupFeedback] = useState<string | null>(
        null
    );

    // ── Helpers ──────────────────────────────────────────────────

    const showFeedback = (
        result: ContactBookMutationResult,
        onSuccess: () => void,
        setter: (msg: string | null) => void
    ) => {
        if (result.ok) {
            setter(null);
            onSuccess();
        } else {
            setter(result.error);
        }
    };

    const handleAddContact = (event: React.SyntheticEvent) => {
        event.preventDefault();
        const result = addContact({ alias, email });
        showFeedback(
            result,
            () => {
                setAlias("");
                setEmail("");
                aliasRef.current?.focus();
            },
            setContactFeedback
        );
    };

    const openEditContact = (contact: Contact) => {
        setEditingContact(contact);
        setEditAlias(contact.alias);
        setEditEmail(contact.email);
        setEditContactFeedback(null);
    };

    const handleEditContact = (event: React.SyntheticEvent) => {
        event.preventDefault();
        if (!editingContact) return;
        const result = updateContact(editingContact.id, {
            alias: editAlias,
            email: editEmail,
        });
        showFeedback(
            result,
            () => setEditingContact(null),
            setEditContactFeedback
        );
    };

    const handleRemoveContact = (id: string) => {
        removeContact(id);
    };

    const toggleMemberId = (
        id: string,
        current: string[],
        setter: (ids: string[]) => void
    ) => {
        if (current.includes(id)) {
            setter(current.filter((m) => m !== id));
        } else {
            setter([...current, id]);
        }
    };

    const validContactIds = new Set(book.contacts.map((c) => c.id));

    const handleAddGroup = (event: React.SyntheticEvent) => {
        event.preventDefault();
        const validIds = groupMemberIds.filter((id) => validContactIds.has(id));
        const result = addGroup({
            name: groupName,
            memberIds: validIds,
        });
        showFeedback(
            result,
            () => {
                setGroupName("");
                setGroupMemberIds([]);
            },
            setGroupFeedback
        );
    };

    const openEditGroup = (group: ContactGroup) => {
        setEditingGroup(group);
        setEditGroupName(group.name);
        setEditGroupMemberIds([...group.memberIds]);
        setEditGroupFeedback(null);
    };

    const handleEditGroup = (event: React.SyntheticEvent) => {
        event.preventDefault();
        if (!editingGroup) return;
        const validIds = editGroupMemberIds.filter((id) =>
            validContactIds.has(id)
        );
        const result = updateGroup(editingGroup.id, {
            name: editGroupName,
            memberIds: validIds,
        });
        showFeedback(result, () => setEditingGroup(null), setEditGroupFeedback);
    };

    const contactMap = new Map(book.contacts.map((c) => [c.id, c]));

    return (
        <div className="min-h-[calc(100vh-4.5rem)] bg-base-200">
            <div className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
                <MailSidebar activePage="contacts" items={items} />

                <main className="bg-base-100 px-5 py-8 sm:px-8 lg:px-10">
                    <div className="mx-auto max-w-5xl">
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
                                {book.contacts.length}명
                            </span>
                        </div>

                        {/* ── Contact add form ─────────────────────── */}
                        <section className="card mt-8 border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <h2 className="card-title">연락처 추가</h2>
                                <form
                                    className="mt-2 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                                    onSubmit={handleAddContact}
                                >
                                    <input
                                        ref={aliasRef}
                                        aria-label="별칭"
                                        className="input w-full"
                                        onChange={(event) =>
                                            setAlias(event.currentTarget.value)
                                        }
                                        placeholder="별칭"
                                        value={alias}
                                    />
                                    <input
                                        aria-label="이메일"
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
                                            alias.trim().length === 0 ||
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
                                {contactFeedback ? (
                                    <p
                                        className="mt-2 text-sm text-error"
                                        role="alert"
                                    >
                                        {contactFeedback}
                                    </p>
                                ) : null}
                            </div>
                        </section>

                        {/* ── Contact table ────────────────────────── */}
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
                                                <th>별칭</th>
                                                <th>이메일</th>
                                                <th aria-label="작업" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {book.contacts.map((contact) => (
                                                <tr key={contact.id}>
                                                    <td className="font-medium">
                                                        {contact.alias}
                                                    </td>
                                                    <td>{contact.email}</td>
                                                    <td className="text-right">
                                                        <button
                                                            aria-label={`${contact.alias} 수정`}
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={() =>
                                                                openEditContact(
                                                                    contact
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            <PencilSimpleIcon
                                                                aria-hidden="true"
                                                                size={18}
                                                            />
                                                        </button>
                                                        <button
                                                            aria-label={`${contact.alias} 삭제`}
                                                            className="btn btn-ghost btn-sm text-error"
                                                            onClick={() =>
                                                                handleRemoveContact(
                                                                    contact.id
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            <TrashIcon
                                                                aria-hidden="true"
                                                                size={18}
                                                            />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>

                        {/* ── Group management ──────────────────────── */}
                        <section className="card mt-5 border border-base-300 bg-base-100 shadow-sm">
                            <div className="card-body">
                                <h2 className="card-title">그룹 관리</h2>

                                {book.contacts.length === 0 ? (
                                    <p className="mt-2 text-sm text-base-content/60">
                                        그룹을 만들려면 먼저 연락처를
                                        추가해주세요.
                                    </p>
                                ) : (
                                    <form
                                        className="mt-2 space-y-3"
                                        onSubmit={handleAddGroup}
                                    >
                                        <input
                                            aria-label="그룹 이름"
                                            className="input w-full"
                                            onChange={(event) =>
                                                setGroupName(
                                                    event.currentTarget.value
                                                )
                                            }
                                            placeholder="그룹 이름"
                                            value={groupName}
                                        />
                                        <fieldset>
                                            <legend className="mb-2 text-sm font-medium text-base-content/70">
                                                구성원 선택
                                            </legend>
                                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                {book.contacts.map((c) => (
                                                    <label
                                                        className="flex cursor-pointer items-center gap-2 text-sm"
                                                        key={c.id}
                                                    >
                                                        <input
                                                            checked={groupMemberIds.includes(
                                                                c.id
                                                            )}
                                                            className="checkbox checkbox-primary checkbox-sm"
                                                            onChange={() =>
                                                                toggleMemberId(
                                                                    c.id,
                                                                    groupMemberIds,
                                                                    setGroupMemberIds
                                                                )
                                                            }
                                                            type="checkbox"
                                                        />
                                                        <span>
                                                            {c.alias}
                                                            <span className="ml-1 text-base-content/50">
                                                                ({c.email})
                                                            </span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>
                                        <button
                                            className="btn btn-primary"
                                            disabled={
                                                groupName.trim().length === 0 ||
                                                groupMemberIds.length === 0
                                            }
                                            type="submit"
                                        >
                                            <PlusIcon
                                                aria-hidden="true"
                                                size={18}
                                            />
                                            그룹 추가
                                        </button>
                                        {groupFeedback ? (
                                            <p
                                                className="text-sm text-error"
                                                role="alert"
                                            >
                                                {groupFeedback}
                                            </p>
                                        ) : null}
                                    </form>
                                )}

                                {book.groups.length > 0 ? (
                                    <div className="mt-5 overflow-x-auto">
                                        <table className="table table-zebra">
                                            <thead>
                                                <tr>
                                                    <th>그룹명</th>
                                                    <th>구성원</th>
                                                    <th aria-label="작업" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {book.groups.map((group) => (
                                                    <tr key={group.id}>
                                                        <td className="font-medium">
                                                            {group.name}
                                                        </td>
                                                        <td>
                                                            {group.memberIds
                                                                .map(
                                                                    (mid) =>
                                                                        contactMap.get(
                                                                            mid
                                                                        )
                                                                            ?.alias ??
                                                                        "?"
                                                                )
                                                                .join(", ")}
                                                            <span className="ml-2 text-xs text-base-content/50">
                                                                (
                                                                {
                                                                    group
                                                                        .memberIds
                                                                        .length
                                                                }
                                                                명)
                                                            </span>
                                                        </td>
                                                        <td className="text-right">
                                                            <button
                                                                aria-label={`${group.name} 수정`}
                                                                className="btn btn-ghost btn-sm"
                                                                onClick={() =>
                                                                    openEditGroup(
                                                                        group
                                                                    )
                                                                }
                                                                type="button"
                                                            >
                                                                <PencilSimpleIcon
                                                                    aria-hidden="true"
                                                                    size={18}
                                                                />
                                                            </button>
                                                            <button
                                                                aria-label={`${group.name} 삭제`}
                                                                className="btn btn-ghost btn-sm text-error"
                                                                onClick={() =>
                                                                    removeGroup(
                                                                        group.id
                                                                    )
                                                                }
                                                                type="button"
                                                            >
                                                                <TrashIcon
                                                                    aria-hidden="true"
                                                                    size={18}
                                                                />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="mt-5 text-sm text-base-content/50">
                                        등록된 그룹이 없습니다.
                                    </p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* ── Edit contact modal ─────────────────────── */}
                    {editingContact ? (
                        <div
                            className="modal modal-open"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="edit-contact-title"
                        >
                            <div className="modal-box max-w-md">
                                <button
                                    className="btn btn-md btn-circle btn-ghost absolute right-3 top-3"
                                    aria-label="닫기"
                                    onClick={() => setEditingContact(null)}
                                    type="button"
                                >
                                    <XIcon
                                        aria-hidden="true"
                                        size={22}
                                        weight="bold"
                                    />
                                </button>
                                <h2
                                    className="text-xl font-semibold"
                                    id="edit-contact-title"
                                >
                                    연락처 수정
                                </h2>
                                <form
                                    className="mt-5 space-y-4"
                                    onSubmit={handleEditContact}
                                >
                                    <label className="fieldset">
                                        <span className="label">별칭</span>
                                        <input
                                            aria-label="수정 별칭"
                                            className="input w-full"
                                            onChange={(event) =>
                                                setEditAlias(
                                                    event.currentTarget.value
                                                )
                                            }
                                            value={editAlias}
                                        />
                                    </label>
                                    <label className="fieldset">
                                        <span className="label">이메일</span>
                                        <input
                                            aria-label="수정 이메일"
                                            className="input w-full"
                                            onChange={(event) =>
                                                setEditEmail(
                                                    event.currentTarget.value
                                                )
                                            }
                                            type="email"
                                            value={editEmail}
                                        />
                                    </label>
                                    {editContactFeedback ? (
                                        <p
                                            className="text-sm text-error"
                                            role="alert"
                                        >
                                            {editContactFeedback}
                                        </p>
                                    ) : null}
                                    <div className="modal-action">
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() =>
                                                setEditingContact(null)
                                            }
                                            type="button"
                                        >
                                            취소
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            disabled={
                                                editAlias.trim().length === 0 ||
                                                editEmail.trim().length === 0
                                            }
                                            type="submit"
                                        >
                                            저장
                                        </button>
                                    </div>
                                </form>
                            </div>
                            <button
                                aria-label="모달 배경 닫기"
                                className="modal-backdrop"
                                onClick={() => setEditingContact(null)}
                                type="button"
                            />
                        </div>
                    ) : null}

                    {/* ── Edit group modal ────────────────────────── */}
                    {editingGroup ? (
                        <div
                            className="modal modal-open"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="edit-group-title"
                        >
                            <div className="modal-box max-w-md">
                                <button
                                    className="btn btn-md btn-circle btn-ghost absolute right-3 top-3"
                                    aria-label="닫기"
                                    onClick={() => setEditingGroup(null)}
                                    type="button"
                                >
                                    <XIcon
                                        aria-hidden="true"
                                        size={22}
                                        weight="bold"
                                    />
                                </button>
                                <h2
                                    className="text-xl font-semibold"
                                    id="edit-group-title"
                                >
                                    그룹 수정
                                </h2>
                                <form
                                    className="mt-5 space-y-4"
                                    onSubmit={handleEditGroup}
                                >
                                    <label className="fieldset">
                                        <span className="label">그룹 이름</span>
                                        <input
                                            aria-label="수정 그룹 이름"
                                            className="input w-full"
                                            onChange={(event) =>
                                                setEditGroupName(
                                                    event.currentTarget.value
                                                )
                                            }
                                            value={editGroupName}
                                        />
                                    </label>
                                    <fieldset>
                                        <legend className="mb-2 text-sm font-medium text-base-content/70">
                                            구성원 선택
                                        </legend>
                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {book.contacts.map((c) => (
                                                <label
                                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                                    key={c.id}
                                                >
                                                    <input
                                                        checked={editGroupMemberIds.includes(
                                                            c.id
                                                        )}
                                                        className="checkbox checkbox-primary checkbox-sm"
                                                        onChange={() =>
                                                            toggleMemberId(
                                                                c.id,
                                                                editGroupMemberIds,
                                                                setEditGroupMemberIds
                                                            )
                                                        }
                                                        type="checkbox"
                                                    />
                                                    <span>
                                                        {c.alias}
                                                        <span className="ml-1 text-base-content/50">
                                                            ({c.email})
                                                        </span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                    {editGroupFeedback ? (
                                        <p
                                            className="text-sm text-error"
                                            role="alert"
                                        >
                                            {editGroupFeedback}
                                        </p>
                                    ) : null}
                                    <div className="modal-action">
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() =>
                                                setEditingGroup(null)
                                            }
                                            type="button"
                                        >
                                            취소
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            disabled={
                                                editGroupName.trim().length ===
                                                    0 ||
                                                editGroupMemberIds.length === 0
                                            }
                                            type="submit"
                                        >
                                            저장
                                        </button>
                                    </div>
                                </form>
                            </div>
                            <button
                                aria-label="모달 배경 닫기"
                                className="modal-backdrop"
                                onClick={() => setEditingGroup(null)}
                                type="button"
                            />
                        </div>
                    ) : null}
                </main>
            </div>
        </div>
    );
}
