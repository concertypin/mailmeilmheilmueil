import { createContext, type ReactNode, useContext, useState } from "react";

interface MailWorkspaceValue {
    reviewedMailIds: Set<string>;
    draftsByMailId: Readonly<Record<string, string>>;
    markReviewed: (mailId: string, promotionDraft: string) => void;
}

const mailWorkspaceContext = createContext<MailWorkspaceValue>({
    reviewedMailIds: new Set(),
    draftsByMailId: {},
    markReviewed: () => undefined,
});

export function MailWorkspaceProvider({ children }: { children: ReactNode }) {
    const [reviewedMailIds, setReviewedMailIds] = useState<Set<string>>(
        new Set()
    );
    const [draftsByMailId, setDraftsByMailId] = useState<
        Record<string, string>
    >({});

    return (
        <mailWorkspaceContext.Provider
            value={{
                reviewedMailIds,
                draftsByMailId,
                markReviewed: (mailId, promotionDraft) => {
                    setDraftsByMailId((currentDrafts) => ({
                        ...currentDrafts,
                        [mailId]: promotionDraft,
                    }));
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
