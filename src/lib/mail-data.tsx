import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { MailItem } from "@/lib/mail-schema";
import { fromMailApiItem, MailApiItemSchema } from "@/lib/mail-schema";
import { throwIfUnauthorized } from "@/lib/imap-basic";

export interface MailDataSource {
    readonly initialItems: readonly MailItem[] | null;
    list(): Promise<MailItem[]>;
    get(id: string): Promise<MailItem | null>;
    review(item: MailItem, promotionDraft: string): Promise<MailItem>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

async function parseApiError(res: Response): Promise<string> {
    throwIfUnauthorized(res);
    const body: unknown = await res.json().catch(() => null);
    if (isRecord(body) && typeof body.error === "string") {
        return body.error;
    }
    return "Mail API request failed.";
}

export function createAttachedMailDataSource(
    fetchImpl: typeof fetch = fetch
): MailDataSource {
    return {
        initialItems: null,
        async list() {
            const res = await fetchImpl("/api/mails");
            if (!res.ok) {
                throw new Error(await parseApiError(res));
            }
            const raw = MailApiItemSchema.array().parse(await res.json());
            return raw.map(fromMailApiItem);
        },
        async get(id: string) {
            const res = await fetchImpl(`/api/mails/${id}`);
            if (res.status === 404) return null;
            if (!res.ok) {
                throw new Error(await parseApiError(res));
            }
            const raw = MailApiItemSchema.parse(await res.json());
            return fromMailApiItem(raw);
        },
        async review(item: MailItem, promotionDraft: string) {
            const trimmed = promotionDraft.trim();
            const res = await fetchImpl(`/api/mails/${item.id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promotionDraft: trimmed }),
            });
            if (!res.ok) {
                throw new Error(await parseApiError(res));
            }
            const raw = MailApiItemSchema.parse(await res.json());
            return fromMailApiItem(raw);
        },
    };
}

interface MailDataContextValue {
    items: MailItem[] | null;
    isLoading: boolean;
    loadError: string | null;
    get: (id: string) => Promise<MailItem | null>;
    review: (item: MailItem, promotionDraft: string) => Promise<MailItem>;
    refresh: () => Promise<void>;
}

const MailDataContext = createContext<MailDataContextValue>({
    items: null,
    isLoading: false,
    loadError: null,
    get: () => Promise.resolve(null),
    review: () => Promise.reject(new Error("MailDataProvider not mounted")),
    refresh: () => Promise.reject(new Error("MailDataProvider not mounted")),
});

export function MailDataProvider({
    children,
    source,
}: {
    children: ReactNode;
    source?: MailDataSource;
}) {
    const resolvedSource = useMemo(
        () => source ?? createAttachedMailDataSource(),
        [source]
    );

    const [items, setItems] = useState<MailItem[] | null>(() =>
        resolvedSource.initialItems ? [...resolvedSource.initialItems] : null
    );
    const [isLoading, setIsLoading] = useState(
        () => !resolvedSource.initialItems
    );
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (resolvedSource.initialItems) {
            return;
        }
        // Avoid calling API when redirected due to invalid credentials
        if (window.location.search.includes("imapCredentialsInvalid=1")) {
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        setLoadError(null);
        resolvedSource
            .list()
            .then((result) => {
                if (!cancelled) {
                    setItems((prev) => {
                        if (!prev) return result;
                        const prevMap = new Map(prev.map((i) => [i.id, i]));
                        return result.map(
                            (item) => prevMap.get(item.id) ?? item
                        );
                    });
                    setIsLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setLoadError(
                        err instanceof Error ? err.message : String(err)
                    );
                    setIsLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [resolvedSource]);

    const itemsRef = useRef(items);
    itemsRef.current = items;

    const get = useCallback(
        async (id: string) => {
            const cached = itemsRef.current?.find((item) => item.id === id);
            if (cached) return cached;
            const result = await resolvedSource.get(id);
            if (result) {
                setItems((prev) => {
                    if (!prev) return [result];
                    if (prev.some((i) => i.id === result.id)) return prev;
                    return [...prev, result];
                });
            }
            return result;
        },
        [resolvedSource]
    );

    const review = useCallback(
        async (item: MailItem, promotionDraft: string) => {
            const result = await resolvedSource.review(item, promotionDraft);
            setItems((prev) =>
                prev
                    ? prev.map((i) => (i.id === item.id ? result : i))
                    : [result]
            );
            return result;
        },
        [resolvedSource]
    );

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const result = await resolvedSource.list();
            setItems(result);
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [resolvedSource]);

    const value = useMemo<MailDataContextValue>(
        () => ({ items, isLoading, loadError, get, review, refresh }),
        [items, isLoading, loadError, get, review, refresh]
    );

    return (
        <MailDataContext.Provider value={value}>
            {children}
        </MailDataContext.Provider>
    );
}

export function useMailData(): MailDataContextValue {
    return useContext(MailDataContext);
}
