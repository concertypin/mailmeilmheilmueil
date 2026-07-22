import { createContext, type ReactNode, useContext, useState } from "react";

interface MailWorkspaceValue {
    reviewedMailIds: Set<string>;
    markReviewed: (mailId: string) => void;
}

const mailWorkspaceContext = createContext<MailWorkspaceValue>({
    reviewedMailIds: new Set(),
    markReviewed: () => undefined,
});

export function MailWorkspaceProvider({ children }: { children: ReactNode }) {
    const [reviewedMailIds, setReviewedMailIds] = useState<Set<string>>(
        new Set()
    );

    return (
        <mailWorkspaceContext.Provider
            value={{
                reviewedMailIds,
                markReviewed: (mailId) => {
                    setReviewedMailIds((currentReviewedMailIds) =>
                        new Set(currentReviewedMailIds).add(mailId)
                    );
                },
            }}
        >
            {children}
        </mailWorkspaceContext.Provider>
    );
}

export function useMailWorkspace(): MailWorkspaceValue {
    return useContext(mailWorkspaceContext);
}
