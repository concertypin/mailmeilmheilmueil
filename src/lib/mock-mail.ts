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
    {
        id: "career-training-mail",
        senderName: "미래직업교육원",
        senderAddress: "career@example.invalid",
        recipients: ["staff@example.com"],
        subject: "2026 하계 데이터 분석 직업훈련 참가자 모집",
        textBody:
            "취업 준비생을 위한 실무 중심 데이터 분석 직업훈련 참가자를 모집합니다.",
        receivedAt: timestamp("2026-07-22T10:30:00+09:00"),
        externalMessageId: null,
        status: "ready",
        processedAt: timestamp("2026-07-22T10:31:00+09:00"),
        reviewedAt: null,
        failureMessage: null,
        analysis: {
            category: "직업훈련",
            audience: "취업 준비 중인 재학생",
            schedule: "2026년 8월 10일~14일",
            applicationDeadline: "2026-08-05",
            benefits: "현직자 멘토링 및 수료증",
            applicationMethod: "온라인 사전 신청",
            contactOrReference: "미래직업교육원 02-1234-5678",
            reviewNotes: ["교육 일정과 수료 혜택을 확인했습니다."],
            promotionDraft:
                "현직자 멘토링과 함께하는 데이터 분석 직업훈련 참가자를 모집합니다.",
        },
    },
    {
        id: "unprocessed-mail",
        senderName: "산학협력단",
        senderAddress: "industry@example.invalid",
        recipients: ["staff@example.com"],
        subject: "분석 진행 중인 산학협력 프로그램 안내",
        textBody:
            "지역 기업과 함께하는 산학협력 프로그램 설명회와 현장실습 참가자를 안내합니다. 자세한 일정과 신청 방법은 분석이 완료되면 확인할 수 있습니다.",
        receivedAt: timestamp("2026-07-22T11:00:00+09:00"),
        externalMessageId: null,
        status: "processing",
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: null,
    },
];
