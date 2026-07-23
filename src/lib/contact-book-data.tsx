/**
 * React context provider for the browser-local address book.
 *
 * Exposes the current `ContactBook`, pure CRUD callbacks, and a
 * `storageWarning` flag.  Each successful mutation is persisted to
 * `localStorage` automatically.  If the store was corrupt on load but is
 * writable, the first mutation overwrites the corrupt data and clears the
 * warning.
 *
 * @module contact-book-data
 */

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import type { ReactNode } from "react";
import {
    type ContactBook,
    type ContactBookMutationResult,
    type ContactGroupInput,
    type ContactInput,
    addContact,
    addGroup,
    loadContactBook,
    removeContact,
    removeGroup,
    saveContactBook,
    updateContact,
    updateGroup,
} from "@/lib/contact-book";

// ── Context shape ─────────────────────────────────────────────────────

export interface AddressBookContextValue {
    /** The current address book. */
    book: ContactBook;
    /** `true` when localStorage was unavailable or data was corrupt on load. */
    storageWarning: boolean;
    /** Add a contact.  Returns the mutation result. */
    addContact: (input: ContactInput) => ContactBookMutationResult;
    /** Update a contact by id.  Returns the mutation result. */
    updateContact: (
        id: string,
        input: ContactInput
    ) => ContactBookMutationResult;
    /** Remove a contact by id (cascades to groups). */
    removeContact: (id: string) => void;
    /** Add a group.  Returns the mutation result. */
    addGroup: (input: ContactGroupInput) => ContactBookMutationResult;
    /** Update a group by id.  Returns the mutation result. */
    updateGroup: (
        id: string,
        input: ContactGroupInput
    ) => ContactBookMutationResult;
    /** Remove a group by id. */
    removeGroup: (id: string) => void;
}

const AddressBookContext = createContext<AddressBookContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────

export function AddressBookProvider({
    children,
    storage = globalThis.localStorage ?? null,
}: {
    children?: ReactNode;
    /** Override storage (for tests).  Defaults to `globalThis.localStorage`. */
    storage?: Storage | null;
}) {
    const [{ book, storageWarning }, setState] = useState(() =>
        loadContactBook(storage)
    );

    /** Attempt to persist the book; returns true if the write succeeded. */
    const trySave = useCallback(
        (next: ContactBook): boolean => {
            const saved = saveContactBook(storage, next);
            return saved;
        },
        [storage]
    );

    /** Persist on successful mutation and clear warning if recovery worked. */
    const persist = useCallback(
        (result: ContactBookMutationResult) => {
            if (result.ok) {
                const saved = trySave(result.book);
                setState({
                    book: result.book,
                    // Keep warning only when storage remains unavailable even
                    // after a successful mutation overwrites corrupt data.
                    storageWarning: storageWarning && !saved,
                });
            }
            return result;
        },
        [storageWarning, trySave]
    );

    const ctx = useMemo((): AddressBookContextValue => {
        const addContactCb = (input: ContactInput) =>
            persist(addContact(book, input));

        const updateContactCb = (id: string, input: ContactInput) =>
            persist(updateContact(book, id, input));

        const removeContactCb = (id: string) => {
            const next = removeContact(book, id);
            const saved = trySave(next);
            setState({
                book: next,
                storageWarning: storageWarning && !saved,
            });
        };

        const addGroupCb = (input: ContactGroupInput) =>
            persist(addGroup(book, input));

        const updateGroupCb = (id: string, input: ContactGroupInput) =>
            persist(updateGroup(book, id, input));

        const removeGroupCb = (id: string) => {
            const next = removeGroup(book, id);
            const saved = trySave(next);
            setState({
                book: next,
                storageWarning: storageWarning && !saved,
            });
        };

        return {
            book,
            storageWarning,
            addContact: addContactCb,
            updateContact: updateContactCb,
            removeContact: removeContactCb,
            addGroup: addGroupCb,
            updateGroup: updateGroupCb,
            removeGroup: removeGroupCb,
        };
    }, [book, storageWarning, persist, trySave]);

    return (
        <AddressBookContext.Provider value={ctx}>
            {children}
        </AddressBookContext.Provider>
    );
}

// ── Hook ──────────────────────────────────────────────────────────────

/**
 * Access the current address book and its mutation helpers.
 * Must be called within an `<AddressBookProvider>`.
 */
export function useAddressBook(): AddressBookContextValue {
    const ctx = useContext(AddressBookContext);
    if (!ctx) {
        throw new Error(
            "useAddressBook must be used within an <AddressBookProvider>"
        );
    }
    return ctx;
}
