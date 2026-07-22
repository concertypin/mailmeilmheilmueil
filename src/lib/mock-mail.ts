import type { MailItem } from "./mail-schema";

function timestamp(date: string): MailItem["receivedAt"] {
    const value = new Date(date);
    return {
        toDate: () => value,
        toMillis: () => value.getTime(),
    };
}

export const mockMailItems: MailItem[] = [
    {
        id: "welcome-mail",
        senderName: "강남대학교 학생지원팀",
        senderAddress: "student-support@kangnam.ac.kr",
        recipients: ["staff@example.com"],
        subject: "2026학년도 비교과 프로그램 참가자 모집",
        textBody:
            "학생들의 진로와 역량 개발을 위한 비교과 프로그램 참가자를 모집합니다.",
        receivedAt: timestamp("2026-07-21T09:00:00+09:00"),
        externalMessageId: null,
        status: "ready",
        processedAt: timestamp("2026-07-21T09:01:00+09:00"),
        reviewedAt: null,
        failureMessage: null,
        analysis: {
            category: "외부 프로그램",
            audience: "강남대학교 재학생",
            schedule: "2026년 8월 중 진행",
            applicationDeadline: "2026-07-31",
            benefits: "참가 수료증 및 비교과 마일리지 제공",
            applicationMethod: "학생역량개발시스템에서 신청",
            contactOrReference: "학생지원팀 02-0000-0000",
            reviewNotes: ["모집 기간과 신청 방법을 확인했습니다."],
            promotionDraft:
                "학생들의 성장을 지원하는 비교과 프로그램 참가자를 모집합니다.",
        },
    },
];

export function findMockMailItem(id: string): MailItem | null {
    return mockMailItems.find((item) => item.id === id) ?? null;
}
