import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    AnalysisCriteriaSchema,
    resolveAnalysisFields,
    type AnalysisCriteria,
    type AnalysisField,
} from "@/lib/mail-schema";
import {
    encodeImapBasicAuthorization,
    loadImapBasicCredentials,
    throwIfUnauthorized,
} from "@/lib/imap-basic";

// ── Context shape ───────────────────────────────────────────────────

export interface AnalysisCriteriaContextValue {
    criteria: AnalysisCriteria;
    fields: readonly AnalysisField[];
    isLoading: boolean;
    loadError: string | null;
    saveCriteria: (criteria: AnalysisCriteria) => Promise<void>;
    saveError: string | null;
    isSaving: boolean;
}

const AnalysisCriteriaContext =
    createContext<AnalysisCriteriaContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

export function AnalysisCriteriaProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [criteria, setCriteria] = useState<AnalysisCriteria>({
        disabledDefaultKeys: [],
        customFields: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const fields = useMemo(() => resolveAnalysisFields(criteria), [criteria]);

    const credentials = useMemo(() => loadImapBasicCredentials(), []);

    useEffect(() => {
        if (!credentials) {
            setIsLoading(false);
            return;
        }

        const auth = encodeImapBasicAuthorization(
            credentials.account,
            credentials.password
        );

        const cancelled = false;
        setIsLoading(true);
        setLoadError(null);

        fetch("/api/analysis-criteria", {
            headers: { authorization: auth },
        })
            .then((res) => {
                if (!res.ok) {
                    throwIfUnauthorized(res);
                    throw new Error("Failed to load analysis criteria");
                }
                return res.json() as Promise<unknown>;
            })
            .then((data) => {
                if (cancelled) return;
                const result = AnalysisCriteriaSchema.safeParse(data);
                if (result.success) {
                    setCriteria(result.data);
                }
                setIsLoading(false);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message =
                    err instanceof Error
                        ? err.message
                        : "Failed to load analysis criteria";
                setLoadError(message);
                setIsLoading(false);
            });
    }, [credentials]);

    const saveCriteria = useCallback(
        async (updated: AnalysisCriteria) => {
            if (!credentials) {
                throw new Error("IMAP credentials are required to save");
            }

            setIsSaving(true);
            setSaveError(null);

            try {
                const auth = encodeImapBasicAuthorization(
                    credentials.account,
                    credentials.password
                );

                const res = await fetch("/api/analysis-criteria", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        authorization: auth,
                    },
                    body: JSON.stringify(updated),
                });

                if (!res.ok) {
                    throwIfUnauthorized(res);
                    throw new Error("Failed to save analysis criteria");
                }

                const data: unknown = await res.json();
                const parsed = AnalysisCriteriaSchema.parse(data);
                setCriteria(parsed);
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Failed to save analysis criteria";
                setSaveError(message);
                throw err;
            } finally {
                setIsSaving(false);
            }
        },
        [credentials]
    );
    const value: AnalysisCriteriaContextValue = {
        criteria,
        fields,
        isLoading,
        loadError,
        saveCriteria,
        saveError,
        isSaving,
    };

    return (
        <AnalysisCriteriaContext.Provider value={value}>
            {children}
        </AnalysisCriteriaContext.Provider>
    );
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useAnalysisCriteria(): AnalysisCriteriaContextValue {
    const context = useContext(AnalysisCriteriaContext);
    if (!context) {
        throw new Error(
            "useAnalysisCriteria must be used within AnalysisCriteriaProvider"
        );
    }
    return context;
}
