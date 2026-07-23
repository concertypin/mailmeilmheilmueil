export function createMockLocalStorage(): Storage {
    let store: Record<string, string> = {};

    const storage: Storage = {
        get length(): number {
            return Object.keys(store).length;
        },
        key(index: number): string | null {
            const keys = Object.keys(store);
            return keys[index] ?? null;
        },
        getItem(key: string): string | null {
            return store[key] ?? null;
        },
        setItem(key: string, value: string): void {
            store[key] = String(value);
        },
        removeItem(key: string): void {
            delete store[key];
        },
        clear(): void {
            store = {};
        },
    };

    return storage;
}
