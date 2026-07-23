/**
 * Unit tests for the pure address-book module.
 *
 * These tests import {@link src/lib/contact-book.ts} directly with no React
 * dependencies and run in Vitest's default Node environment.
 */

import { assert, describe, expect, test } from "vitest";
import {
    type ContactBook,
    type ContactBookMutationResult,
    addContact,
    addGroup,
    removeContact,
    removeGroup,
    resolveRecipients,
    sanitizeContactBook,
    updateContact,
    updateGroup,
} from "@/lib/contact-book";

// ── Helpers ───────────────────────────────────────────────────────────

/** A deterministic seed for tests that do not need to mutate. */
const seedBook: ContactBook = {
    contacts: [
        { id: "c1", alias: "Alice", email: "alice@example.com" },
        { id: "c2", alias: "Bob", email: "bob@example.com" },
        { id: "c3", alias: "Charlie", email: "charlie@example.com" },
    ],
    groups: [{ id: "g1", name: "Devs", memberIds: ["c1", "c2"] }],
};

const ok = (r: ContactBookMutationResult) => r.ok === true;
const book = (r: ContactBookMutationResult): ContactBook =>
    r.ok === true
        ? r.book
        : (() => {
              throw new Error("not ok");
          })();

// ── addContact ────────────────────────────────────────────────────────

describe("addContact", () => {
    test("adds a valid contact", () => {
        const r = addContact(seedBook, {
            alias: "Diana",
            email: "diana@example.com",
        });
        expect(ok(r)).toBe(true);
        expect(book(r).contacts).toHaveLength(4);
        expect(book(r).contacts.find((c) => c.alias === "Diana")?.email).toBe(
            "diana@example.com"
        );
    });

    test("rejects blank alias", () => {
        const r = addContact(seedBook, { alias: "  ", email: "x@y" });
        expect(ok(r)).toBe(false);
    });

    test("rejects blank email", () => {
        const r = addContact(seedBook, { alias: "X", email: "" });
        expect(ok(r)).toBe(false);
    });

    test("rejects malformed email", () => {
        const r = addContact(seedBook, { alias: "X", email: "not-an-email" });
        expect(ok(r)).toBe(false);
    });

    test("rejects duplicate email (case insensitive)", () => {
        const r = addContact(seedBook, {
            alias: "Alice2",
            email: "ALICE@example.com",
        });
        expect(ok(r)).toBe(false);
    });

    test("rejects duplicate alias (case insensitive)", () => {
        const r = addContact(seedBook, {
            alias: "alice",
            email: "new@example.com",
        });
        expect(ok(r)).toBe(false);
    });

    test("trims alias and email", () => {
        const r = addContact(seedBook, {
            alias: "  Diana  ",
            email: "  DIANA@EXAMPLE.COM  ",
        });
        expect(ok(r)).toBe(true);
        const c = book(r).contacts.find((x) => x.alias === "Diana");
        expect(c).toBeDefined();
        expect(c!.email).toBe("diana@example.com");
    });
});

// ── updateContact ─────────────────────────────────────────────────────

describe("updateContact", () => {
    test("updates existing contact", () => {
        const r = updateContact(seedBook, "c1", {
            alias: "Alice A.",
            email: "alice.a@example.com",
        });
        expect(ok(r)).toBe(true);
        const c = book(r).contacts.find((x) => x.id === "c1");
        assert(c);
        expect(c.alias).toBe("Alice A.");
        expect(c.email).toBe("alice.a@example.com");
    });

    test("rejects unknown id", () => {
        const r = updateContact(seedBook, "ghost", {
            alias: "X",
            email: "x@y",
        });
        expect(ok(r)).toBe(false);
    });
});

// ── removeContact (cascade) ───────────────────────────────────────────

describe("removeContact cascade", () => {
    test("removes contact from groups and deletes empty groups", () => {
        const result = removeContact(seedBook, "c1");
        expect(result.contacts).toHaveLength(2);
        expect(result.contacts.find((c) => c.id === "c1")).toBeUndefined();
        expect(result.groups).toHaveLength(1);
        expect(result.groups.find((g) => g.id === "g1")?.memberIds).toEqual([
            "c2",
        ]);
    });

    test("deletes a group left empty after removal", () => {
        const book2: ContactBook = {
            contacts: [{ id: "c1", alias: "X", email: "x@y" }],
            groups: [{ id: "g1", name: "Solo", memberIds: ["c1"] }],
        };
        const result = removeContact(book2, "c1");
        expect(result.contacts).toHaveLength(0);
        expect(result.groups).toHaveLength(0);
    });
});

// ── addGroup ──────────────────────────────────────────────────────────

describe("addGroup", () => {
    test("adds a valid group", () => {
        const r = addGroup(seedBook, {
            name: "Designers",
            memberIds: ["c1", "c3"],
        });
        expect(ok(r)).toBe(true);
        expect(book(r).groups).toHaveLength(2);
    });

    test("rejects blank name", () => {
        const r = addGroup(seedBook, {
            name: "  ",
            memberIds: ["c1"],
        });
        expect(ok(r)).toBe(false);
    });

    test("rejects duplicate group name", () => {
        const r = addGroup(seedBook, {
            name: "devs",
            memberIds: ["c3"],
        });
        expect(ok(r)).toBe(false);
    });

    test("rejects unknown member ids", () => {
        const r = addGroup(seedBook, {
            name: "Ghosts",
            memberIds: ["ghost-id"],
        });
        expect(ok(r)).toBe(false);
    });

    test("rejects empty member list", () => {
        const r = addGroup(seedBook, {
            name: "Empty",
            memberIds: [],
        });
        expect(ok(r)).toBe(false);
    });
});

// ── updateGroup ───────────────────────────────────────────────────────

describe("updateGroup", () => {
    test("updates existing group", () => {
        const r = updateGroup(seedBook, "g1", {
            name: "Engineers",
            memberIds: ["c1", "c2", "c3"],
        });
        expect(ok(r)).toBe(true);
        const g = book(r).groups.find((x) => x.id === "g1");
        assert(g);
        expect(g.name).toBe("Engineers");
        expect(g.memberIds).toHaveLength(3);
    });

    test("rejects duplicate name on update", () => {
        const book2: ContactBook = {
            contacts: [
                { id: "c1", alias: "A", email: "a@x" },
                { id: "c2", alias: "B", email: "b@x" },
            ],
            groups: [
                { id: "g1", name: "Devs", memberIds: ["c1"] },
                { id: "g2", name: "Designers", memberIds: ["c2"] },
            ],
        };
        const r = updateGroup(book2, "g1", {
            name: "designers",
            memberIds: ["c1"],
        });
        expect(ok(r)).toBe(false);
    });
});

// ── removeGroup ───────────────────────────────────────────────────────

describe("removeGroup", () => {
    test("removes a group without affecting contacts", () => {
        const result = removeGroup(seedBook, "g1");
        expect(result.groups).toHaveLength(0);
        expect(result.contacts).toHaveLength(3);
    });
});

// ── resolveRecipients ─────────────────────────────────────────────────

describe("resolveRecipients", () => {
    test("direct contact appears in To", () => {
        const r = resolveRecipients(seedBook, [{ kind: "contact", id: "c1" }]);
        expect(r.to).toHaveLength(1);
        assert(r.to[0]);
        expect(r.to[0].id).toBe("c1");
        expect(r.bcc).toHaveLength(0);
    });

    test("group expands to Bcc", () => {
        const r = resolveRecipients(seedBook, [{ kind: "group", id: "g1" }]);
        expect(r.to).toHaveLength(0);
        expect(r.bcc).toHaveLength(2);
    });

    test("direct contact + group containing same contact deduplicates", () => {
        const r = resolveRecipients(seedBook, [
            { kind: "contact", id: "c1" },
            { kind: "group", id: "g1" },
        ]);
        expect(r.to).toHaveLength(1);
        assert(r.to[0]);
        expect(r.to[0].id).toBe("c1");
        expect(r.bcc).toHaveLength(1);
        assert(r.bcc[0]);
        expect(r.bcc[0].id).toBe("c2");
    });

    test("deleted selection id is silently ignored", () => {
        const r = resolveRecipients(seedBook, [
            { kind: "contact", id: "ghost" },
            { kind: "group", id: "ghost-group" },
        ]);
        expect(r.to).toHaveLength(0);
        expect(r.bcc).toHaveLength(0);
    });

    test("preserves selection order with deduplication", () => {
        const r = resolveRecipients(seedBook, [
            { kind: "group", id: "g1" },
            { kind: "contact", id: "c3" },
        ]);
        expect(r.bcc.map((c) => c.id)).toEqual(["c1", "c2"]);
        expect(r.to.map((c) => c.id)).toEqual(["c3"]);
    });

    test("same address in two groups deduplicates", () => {
        const book2: ContactBook = {
            contacts: [
                { id: "c1", alias: "X", email: "x@y" },
                { id: "c2", alias: "Y", email: "y@z" },
            ],
            groups: [
                { id: "g1", name: "G1", memberIds: ["c1", "c2"] },
                { id: "g2", name: "G2", memberIds: ["c1"] },
            ],
        };
        const r = resolveRecipients(book2, [
            { kind: "group", id: "g1" },
            { kind: "group", id: "g2" },
        ]);
        expect(r.bcc).toHaveLength(2);
    });
});

// ── sanitizeContactBook ───────────────────────────────────────────────

describe("sanitizeContactBook", () => {
    test("accepts valid book", () => {
        const r = sanitizeContactBook(seedBook);
        assert(r.ok);
        expect(r.book.contacts).toHaveLength(3);
    });

    test("rejects duplicate emails", () => {
        const r = sanitizeContactBook({
            contacts: [
                { id: "a", alias: "A", email: "dup@example.com" },
                { id: "b", alias: "B", email: "DUP@example.com" },
            ],
            groups: [],
        });
        expect(r.ok).toBe(false);
    });

    test("rejects duplicate aliases", () => {
        const r = sanitizeContactBook({
            contacts: [
                { id: "a", alias: "Same", email: "a@x" },
                { id: "b", alias: "same", email: "b@x" },
            ],
            groups: [],
        });
        expect(r.ok).toBe(false);
    });

    test("rejects dangling memberIds", () => {
        const r = sanitizeContactBook({
            contacts: [{ id: "c1", alias: "Only", email: "o@x" }],
            groups: [{ id: "g1", name: "G", memberIds: ["c1", "ghost"] }],
        });
        expect(r.ok).toBe(false);
    });

    test("rejects empty groups", () => {
        const r = sanitizeContactBook({
            contacts: [{ id: "c1", alias: "A", email: "a@x" }],
            groups: [{ id: "g1", name: "Empty", memberIds: [] }],
        });
        expect(r.ok).toBe(false);
    });

    test("rejects duplicate group names", () => {
        const r = sanitizeContactBook({
            contacts: [
                { id: "c1", alias: "A", email: "a@x" },
                { id: "c2", alias: "B", email: "b@x" },
            ],
            groups: [
                { id: "g1", name: "Team", memberIds: ["c1"] },
                { id: "g2", name: "team", memberIds: ["c2"] },
            ],
        });
        expect(r.ok).toBe(false);
    });

    test("rejects completely malformed input", () => {
        const r = sanitizeContactBook({ not: "a book" });
        expect(r.ok).toBe(false);
    });

    test("rejects null input", () => {
        const r = sanitizeContactBook(null);
        expect(r.ok).toBe(false);
    });
});
