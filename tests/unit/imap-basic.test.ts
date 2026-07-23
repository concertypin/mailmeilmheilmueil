import { describe, expect, it } from "vitest";
import {
    IMAP_BASIC_STORAGE_KEY,
    encodeImapBasicAuthorization,
    loadImapBasicCredentials,
    saveImapBasicCredentials,
    clearImapBasicCredentials,
} from "@/lib/imap-basic";

describe("imap-basic helpers", () => {
    describe("encodeImapBasicAuthorization", () => {
        it.concurrent("encodes ASCII credentials", () => {
            const result = encodeImapBasicAuthorization("user", "pass");
            expect(result).toBe(`Basic ${btoa("user:pass")}`);
        });

        it.concurrent("encodes UTF-8 credentials", () => {
            const result = encodeImapBasicAuthorization(
                "user@강남대학교",
                "비밀번호"
            );
            expect(result).toMatch(/^Basic /);
            // Verify it decodes correctly
            // Verify it round-trips correctly with TextDecoder
            const encoded = result.slice("Basic ".length);
            const binary = atob(encoded);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const decoded = new TextDecoder().decode(bytes);
            expect(decoded).toBe("user@강남대학교:비밀번호");
        });
    });

    describe("saveImapBasicCredentials / loadImapBasicCredentials", () => {
        it.concurrent("saves and loads credentials from storage", () => {
            const storage = new Map<string, string>();
            const fakeStorage: Storage = {
                getItem: (key) => storage.get(key) ?? null,
                setItem: (key, value) => {
                    storage.set(key, value);
                },
                removeItem: (key) => {
                    storage.delete(key);
                },
                length: storage.size,
                clear: () => storage.clear(),
                key: () => null,
            };

            saveImapBasicCredentials(
                { account: "user@test.com", password: "secret" },
                fakeStorage
            );
            expect(storage.has(IMAP_BASIC_STORAGE_KEY)).toBe(true);

            const loaded = loadImapBasicCredentials(fakeStorage);
            expect(loaded).toEqual({
                account: "user@test.com",
                password: "secret",
            });
        });

        it.concurrent("returns null for missing storage entry", () => {
            const fakeStorage: Storage = {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
                length: 0,
                clear: () => {},
                key: () => null,
            };

            expect(loadImapBasicCredentials(fakeStorage)).toBeNull();
        });

        it.concurrent("returns null and removes malformed entry", () => {
            const storage = new Map<string, string>([
                [IMAP_BASIC_STORAGE_KEY, "not-json"],
            ]);
            const fakeStorage: Storage = {
                getItem: (key) => storage.get(key) ?? null,
                setItem: () => {},
                removeItem: (key) => {
                    storage.delete(key);
                },
                length: storage.size,
                clear: () => storage.clear(),
                key: () => null,
            };

            const result = loadImapBasicCredentials(fakeStorage);
            expect(result).toBeNull();
            expect(storage.has(IMAP_BASIC_STORAGE_KEY)).toBe(false);
        });

        it.concurrent(
            "returns null and removes entry with blank account",
            () => {
                const storage = new Map<string, string>([
                    [
                        IMAP_BASIC_STORAGE_KEY,
                        JSON.stringify({ account: "", password: "secret" }),
                    ],
                ]);
                const fakeStorage: Storage = {
                    getItem: (key) => storage.get(key) ?? null,
                    setItem: () => {},
                    removeItem: (key) => {
                        storage.delete(key);
                    },
                    length: storage.size,
                    clear: () => storage.clear(),
                    key: () => null,
                };

                const result = loadImapBasicCredentials(fakeStorage);
                expect(result).toBeNull();
                expect(storage.has(IMAP_BASIC_STORAGE_KEY)).toBe(false);
            }
        );
    });

    describe("clearImapBasicCredentials", () => {
        it.concurrent("removes the storage key", () => {
            const storage = new Map<string, string>([
                [IMAP_BASIC_STORAGE_KEY, '{"a":"b"}'],
            ]);
            const fakeStorage: Storage = {
                getItem: (key) => storage.get(key) ?? null,
                setItem: () => {},
                removeItem: (key) => {
                    storage.delete(key);
                },
                length: storage.size,
                clear: () => storage.clear(),
                key: () => null,
            };

            clearImapBasicCredentials(fakeStorage);
            expect(storage.has(IMAP_BASIC_STORAGE_KEY)).toBe(false);
        });
    });
});
