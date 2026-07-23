/**
 * Browser-local address-book data model, validation, mutations, and persistence.
 *
 * Contacts are alias-to-email pairs, and named groups contain saved contacts
 * by reference (member ID). Recipient resolution expands groups into their
 * member contacts and deduplicates addresses that are also selected directly.
 *
 * @module contact-book
 */

import * as z from "zod";

// ── Data types ────────────────────────────────────────────────────────

export type Contact = {
    id: string;
    alias: string;
    email: string;
};

export type ContactGroup = {
    id: string;
    name: string;
    memberIds: string[];
};

export type ContactBook = {
    contacts: Contact[];
    groups: ContactGroup[];
};

export type RecipientSelection =
    { kind: "contact"; id: string } | { kind: "group"; id: string };

export type ResolvedRecipients = {
    /** Direct-contact recipients – visible To. */
    to: Contact[];
    /** Group-expanded recipients – visible Bcc only. */
    bcc: Contact[];
};

export type ContactInput = {
    alias: string;
    email: string;
};

export type ContactGroupInput = {
    name: string;
    memberIds: string[];
};

export type ContactBookMutationResult =
    { ok: true; book: ContactBook } | { ok: false; error: string };

// ── Storage key ───────────────────────────────────────────────────────

const STORAGE_KEY = "mailmeilmheilmueil.contact-book.v1";

// ── Helpers ───────────────────────────────────────────────────────────

/** Map an opaque, runtime-safe ID to a normalized display key. */

const sortKey = (...parts: string[]): string =>
    parts.join("\0").toLocaleLowerCase();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isNonBlank = (s: string): boolean => s.trim().length > 0;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Generate a client-side ID that does not require a secure context. */
let idCounter = 0;
export function generateId(): string {
    idCounter += 1;
    return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Seed data ─────────────────────────────────────────────────────────

/**
 * The default address book shipped to every first-use or recovery path.
 * Matches the two contacts the existing page used as `initialContacts`.
 */
const SEED_BOOK: ContactBook = {
    contacts: [
        {
            id: generateId(),
            alias: "학생 홍보팀",
            email: "promotion@example.com",
        },
        {
            id: generateId(),
            alias: "학생지원팀",
            email: "student-support@example.com",
        },
    ],
    groups: [],
};

// ── Zod schema with cross-record invariant validation ─────────────────

/**
 * Structural schema for a single contact.
 */
const ContactSchema: z.ZodType<Contact> = z.object({
    id: z.string().min(1),
    alias: z.string().min(1),
    email: z.string().min(1),
});

/**
 * Structural schema for a single group.
 */
const ContactGroupSchema: z.ZodType<ContactGroup> = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    memberIds: z.array(z.string().min(1)),
});

/**
 * Structural-only schema (no cross-record invariants).
 */
const ContactBookStructureSchema: z.ZodType<ContactBook> = z.object({
    contacts: z.array(ContactSchema),
    groups: z.array(ContactGroupSchema),
});

/**
 * Full schema that validates every cross-record invariant after structural
 * parsing:
 *
 * - No duplicate normalized emails among contacts.
 * - No duplicate aliases among contacts (case-insensitive).
 * - No duplicate group names (case-insensitive).
 * - No group with zero memberIds.
 * - No dangling memberId — every memberId must reference an existing
 *   contact id.
 *
 * Passes through on `.passthrough` so unknown keys are harmless.
 */
export const ContactBookSchema: z.ZodType<ContactBook> =
    ContactBookStructureSchema.superRefine((book, ctx) => {
        const causes: string[] = [];

        // ── Contacts ──────────────────────────────────────────
        const seenEmails = new Map<string, number>();
        const seenAliases = new Map<string, number>();

        for (const c of book.contacts) {
            const ne = normalizeEmail(c.email);
            const prevEmail = seenEmails.get(ne);
            if (prevEmail !== undefined) {
                ctx.addIssue({
                    code: "custom",
                    message: `Duplicate email "${c.email}" in contacts ${prevEmail} and ${seenEmails.size}`,
                    path: ["contacts"],
                });
                causes.push(
                    `Duplicate email "${c.email}" (contacts ${prevEmail + 1}, ${seenEmails.size + 1})`
                );
            } else {
                seenEmails.set(ne, seenEmails.size);
            }

            const sk = sortKey(c.alias);
            const prevAlias = seenAliases.get(sk);
            if (prevAlias !== undefined) {
                const names = book.contacts
                    .filter((x) => sortKey(x.alias) === sk)
                    .map((x) => x.alias);
                ctx.addIssue({
                    code: "custom",
                    message: `Duplicate alias in contacts: "${names.join('", "')}"`,
                    path: ["contacts"],
                });
                causes.push(`Duplicate alias: "${names.join('", "')}"`);
            } else {
                seenAliases.set(sk, seenAliases.size);
            }
        }

        // ── Groups ────────────────────────────────────────────
        const seenGroupNames = new Map<string, number>();
        const contactIds = new Set(book.contacts.map((c) => c.id));

        for (const g of book.groups) {
            const gnk = sortKey(g.name);
            const prevName = seenGroupNames.get(gnk);
            if (prevName !== undefined) {
                const names = book.groups
                    .filter((x) => sortKey(x.name) === gnk)
                    .map((x) => x.name);
                ctx.addIssue({
                    code: "custom",
                    message: `Duplicate group name: "${names.join('", "')}"`,
                    path: ["groups"],
                });
                causes.push(`Duplicate group name: "${names.join('", "')}"`);
            } else {
                seenGroupNames.set(gnk, seenGroupNames.size);
            }

            if (g.memberIds.length === 0) {
                ctx.addIssue({
                    code: "custom",
                    message: `Group "${g.name}" has no members`,
                    path: ["groups", g.name],
                });
                causes.push(`Group "${g.name}" has no members`);
            }

            for (const mid of g.memberIds) {
                if (!contactIds.has(mid)) {
                    ctx.addIssue({
                        code: "custom",
                        message: `Group "${g.name}" references unknown contact "${mid}"`,
                        path: ["groups", g.name, "memberIds"],
                    });
                    causes.push(
                        `Group "${g.name}" references unknown contact id "${mid}"`
                    );
                }
            }
        }

        // Store causes on the result for the caller to inspect.
        // We tag the refined value so sanitizeContactBook can read
        // them.
        (book as ContactBook & { __causes?: string[] }).__causes = causes;
    });

// ── Sanitize / load helpers ───────────────────────────────────────────

export type SanitizeResult =
    | { ok: true; book: ContactBook }
    | { ok: false; error: string; causes: string[] };

/**
 * Validate and sanitise raw input into a sorted, invariant-free
 * `ContactBook`.  Returns `{ ok: true, book }` on success or
 * `{ ok: false, error, causes }` on failure.
 */
export function sanitizeContactBook(input: unknown): SanitizeResult {
    const parsed = ContactBookSchema.safeParse(input);

    if (!parsed.success) {
        const causes = parsed.error.issues.map((i) => i.message);
        return {
            ok: false,
            error: `Contact book validation failed (${causes.length} issue${causes.length === 1 ? "" : "s"})`,
            causes,
        };
    }

    const book = parsed.data;
    const causes: string[] =
        (book as ContactBook & { __causes?: string[] }).__causes ?? [];

    if (causes.length > 0) {
        return {
            ok: false,
            error: `Contact book invariant violation (${causes.length} issue${causes.length === 1 ? "" : "s"})`,
            causes,
        };
    }

    // Sort contacts by alias, groups by name (case-insensitive).
    const sorted: ContactBook = {
        contacts: [...book.contacts].sort((a, b) =>
            sortKey(a.alias).localeCompare(sortKey(b.alias))
        ),
        groups: [...book.groups].sort((a, b) =>
            sortKey(a.name).localeCompare(sortKey(b.name))
        ),
    };

    return { ok: true, book: sorted };
}

// ── Persistence ───────────────────────────────────────────────────────

/**
 * Load a contact book from the given `Storage` (typically
 * `globalThis.localStorage`).
 *
 * - Missing key → returns the seed (and attempts to persist it).
 * - Schema-invalid / corrupt data → returns the seed in memory with
 *   `storageWarning: true`.
 * - Storage `null` or throws → same fallback with warning.
 *
 * @param storage — a `Storage` instance or `null` (e.g. SSR / tests).
 */
export function loadContactBook(storage: Storage | null): {
    book: ContactBook;
    storageWarning: boolean;
} {
    if (!storage) {
        return { book: structuredClone(SEED_BOOK), storageWarning: true };
    }

    let raw: string | null;
    try {
        raw = storage.getItem(STORAGE_KEY);
    } catch {
        return { book: structuredClone(SEED_BOOK), storageWarning: true };
    }

    if (raw === null) {
        // First run — seed and persist.
        const seed = structuredClone(SEED_BOOK);
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(seed));
        } catch {
            // Storage available for read but not for write — keep warning.
            return { book: seed, storageWarning: true };
        }
        return { book: seed, storageWarning: false };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { book: structuredClone(SEED_BOOK), storageWarning: true };
    }

    const result = sanitizeContactBook(parsed);
    if (!result.ok) {
        return { book: structuredClone(SEED_BOOK), storageWarning: true };
    }

    return { book: result.book, storageWarning: false };
}

/**
 * Persist a contact book to `storage`.
 *
 * @returns `true` on success, `false` if storage is unavailable or throws.
 */
export function saveContactBook(
    storage: Storage | null,
    book: ContactBook
): boolean {
    if (!storage) return false;
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(book));
        return true;
    } catch {
        return false;
    }
}

// ── Pure mutations ────────────────────────────────────────────────────

/**
 * Add a contact to the book, validating all business rules.
 *
 * Rejects: blank alias, invalid email, duplicate email (normalised),
 * duplicate alias (case-insensitive).
 */
export function addContact(
    book: ContactBook,
    input: ContactInput
): ContactBookMutationResult {
    const alias = input.alias.trim();
    if (!isNonBlank(alias)) {
        return { ok: false, error: "별칭을 입력해주세요." };
    }

    const email = normalizeEmail(input.email);
    if (!isNonBlank(email)) {
        return { ok: false, error: "이메일을 입력해주세요." };
    }
    if (!EMAIL_RE.test(email)) {
        return { ok: false, error: "올바른 이메일 형식이 아닙니다." };
    }

    if (book.contacts.some((c) => normalizeEmail(c.email) === email)) {
        return { ok: false, error: "같은 이메일이 이미 등록되어 있습니다." };
    }

    if (book.contacts.some((c) => sortKey(c.alias) === sortKey(alias))) {
        return { ok: false, error: "같은 별칭이 이미 있습니다." };
    }

    const contact: Contact = {
        id: generateId(),
        alias,
        email,
    };

    return {
        ok: true,
        book: {
            contacts: [...book.contacts, contact],
            groups: book.groups,
        },
    };
}

/**
 * Update an existing contact.
 *
 * Rejects: unknown id, blank alias, invalid email, duplicate email/alias
 * that belongs to a *different* contact.
 */
export function updateContact(
    book: ContactBook,
    id: string,
    input: ContactInput
): ContactBookMutationResult {
    const existing = book.contacts.find((c) => c.id === id);
    if (!existing) {
        return { ok: false, error: "연락처를 찾을 수 없습니다." };
    }

    const alias = input.alias.trim();
    if (!isNonBlank(alias)) {
        return { ok: false, error: "별칭을 입력해주세요." };
    }

    const email = normalizeEmail(input.email);
    if (!isNonBlank(email)) {
        return { ok: false, error: "이메일을 입력해주세요." };
    }
    if (!EMAIL_RE.test(email)) {
        return { ok: false, error: "올바른 이메일 형식이 아닙니다." };
    }

    const dupEmail = book.contacts.find(
        (c) => c.id !== id && normalizeEmail(c.email) === email
    );
    if (dupEmail) {
        return { ok: false, error: "같은 이메일이 이미 등록되어 있습니다." };
    }

    const dupAlias = book.contacts.find(
        (c) => c.id !== id && sortKey(c.alias) === sortKey(alias)
    );
    if (dupAlias) {
        return { ok: false, error: "같은 별칭이 이미 있습니다." };
    }

    const updated: Contact = { ...existing, alias, email };

    return {
        ok: true,
        book: {
            contacts: book.contacts.map((c) => (c.id === id ? updated : c)),
            groups: book.groups,
        },
    };
}

/**
 * Remove a contact.  Removes the contact id from every group's
 * `memberIds`, then deletes any group left empty.
 */
export function removeContact(book: ContactBook, id: string): ContactBook {
    const contacts = book.contacts.filter((c) => c.id !== id);

    const groups = book.groups
        .map((g) => ({
            ...g,
            memberIds: g.memberIds.filter((mid) => mid !== id),
        }))
        .filter((g) => g.memberIds.length > 0);

    return { contacts, groups };
}

/**
 * Add a group.
 *
 * Rejects: blank name, duplicate name, no members, unknown member ids.
 */
export function addGroup(
    book: ContactBook,
    input: ContactGroupInput
): ContactBookMutationResult {
    const name = input.name.trim();
    if (!isNonBlank(name)) {
        return { ok: false, error: "그룹 이름을 입력해주세요." };
    }

    if (book.groups.some((g) => sortKey(g.name) === sortKey(name))) {
        return { ok: false, error: "같은 이름의 그룹이 이미 있습니다." };
    }

    const contactIds = new Set(book.contacts.map((c) => c.id));
    const unknownIds = input.memberIds.filter((mid) => !contactIds.has(mid));
    if (unknownIds.length > 0) {
        return {
            ok: false,
            error: "알 수 없는 연락처가 포함되어 있습니다.",
        };
    }

    if (input.memberIds.length === 0) {
        return {
            ok: false,
            error: "그룹에 최소 한 명의 구성원을 추가해주세요.",
        };
    }

    const group: ContactGroup = {
        id: generateId(),
        name,
        memberIds: input.memberIds,
    };

    return {
        ok: true,
        book: {
            contacts: book.contacts,
            groups: [...book.groups, group],
        },
    };
}

/**
 * Update an existing group.
 *
 * Rejects: unknown id, blank name, duplicate name (different group),
 * no members, unknown member ids.
 */
export function updateGroup(
    book: ContactBook,
    id: string,
    input: ContactGroupInput
): ContactBookMutationResult {
    const existing = book.groups.find((g) => g.id === id);
    if (!existing) {
        return { ok: false, error: "그룹을 찾을 수 없습니다." };
    }

    const name = input.name.trim();
    if (!isNonBlank(name)) {
        return { ok: false, error: "그룹 이름을 입력해주세요." };
    }

    const dupGroup = book.groups.find(
        (g) => g.id !== id && sortKey(g.name) === sortKey(name)
    );
    if (dupGroup) {
        return { ok: false, error: "같은 이름의 그룹이 이미 있습니다." };
    }

    const contactIds = new Set(book.contacts.map((c) => c.id));
    const unknownIds = input.memberIds.filter((mid) => !contactIds.has(mid));
    if (unknownIds.length > 0) {
        return {
            ok: false,
            error: "알 수 없는 연락처가 포함되어 있습니다.",
        };
    }

    if (input.memberIds.length === 0) {
        return {
            ok: false,
            error: "그룹에 최소 한 명의 구성원을 추가해주세요.",
        };
    }

    const updated: ContactGroup = {
        ...existing,
        name,
        memberIds: input.memberIds,
    };

    return {
        ok: true,
        book: {
            contacts: book.contacts,
            groups: book.groups.map((g) => (g.id === id ? updated : g)),
        },
    };
}

/**
 * Remove a group by id (no cascade to contacts).
 */
export function removeGroup(book: ContactBook, id: string): ContactBook {
    return {
        contacts: book.contacts,
        groups: book.groups.filter((g) => g.id !== id),
    };
}

// ── Recipient resolution ──────────────────────────────────────────────

/**
 * Resolve selections into To / Bcc recipients.
 *
 * - Direct contacts appear in `to`.
 * - Groups expand into their member contacts; those addresses appear
 *   in `bcc`.
 * - If a contact is selected both directly AND is a member of a
 *   selected group, it appears once in `to` and is excluded from
 *   `bcc`.
 * - A selection whose id no longer exists (deleted contact or group)
 *   is silently ignored.
 * - Address deduplication is preserved; ordering follows selection
 *   order.
 */
export function resolveRecipients(
    book: ContactBook,
    selections: readonly RecipientSelection[]
): ResolvedRecipients {
    const contactMap = new Map<string, Contact>();
    for (const c of book.contacts) {
        contactMap.set(c.id, c);
    }

    const groupMap = new Map<string, ContactGroup>();
    for (const g of book.groups) {
        groupMap.set(g.id, g);
    }

    const to: Contact[] = [];
    const bcc: Contact[] = [];

    const toEmails = new Set<string>();
    const bccEmails = new Set<string>();

    for (const sel of selections) {
        if (sel.kind === "contact") {
            const contact = contactMap.get(sel.id);
            if (!contact) continue;
            const ne = normalizeEmail(contact.email);
            if (!toEmails.has(ne)) {
                toEmails.add(ne);
                to.push(contact);
            }
        } else {
            // kind === "group"
            const group = groupMap.get(sel.id);
            if (!group) continue;
            for (const mid of group.memberIds) {
                const member = contactMap.get(mid);
                if (!member) continue;
                const ne = normalizeEmail(member.email);
                if (toEmails.has(ne)) {
                    // Already in To — skip Bcc to avoid duplication.
                    continue;
                }
                if (!bccEmails.has(ne)) {
                    bccEmails.add(ne);
                    bcc.push(member);
                }
            }
        }
    }

    return { to, bcc };
}
