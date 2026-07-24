import { Timestamp } from "firebase/firestore";
import { type MailItem } from "@/lib/mail-schema";
import { type MailDataSource } from "@/lib/mail-data";

export const CONTACT_BOOK_KEY = "mailmeilmheilmueil.contact-book.v1";

export const readyItem = {
    id: "mail-1",
    senderName: "미래직업교육원",
    senderAddress: "notice@example.invalid",
    recipients: ["promotion@example.invalid"],
    subject: "2026 여름 데이터 분석 직무교육 참가자 모집",
    textBody: "모집 대상: 데이터 분석 직무에 관심 있는 대학생",
    receivedAt: Timestamp.now(),
    externalMessageId: null,
    status: "ready",
    processedAt: Timestamp.now(),
    reviewedAt: null,
    failureMessage: null,
    analysis: {
        category: "직업훈련",
        audience: "데이터 분석 직무에 관심 있는 대학생",
        schedule: "2026-08-10~2026-08-14",
        applicationDeadline: "2026-07-31",
        benefits: "교육비 전액 지원, 수료증 발급",
        applicationMethod: "온라인 신청",
        contactOrReference: null,
        reviewNotes: ["신청 페이지 주소와 문의처는 게시 전 확인 필요"],
    },
    draft: "데이터 분석 직무교육 참가자를 모집합니다.",
} satisfies MailItem;

export const inboxItems: MailItem[] = [
    {
        id: "welcome-mail",
        senderName: "강남대학교 학생지원팀",
        senderAddress: "student-support@kangnam.ac.kr",
        recipients: ["staff@example.com"],
        subject: "2026학년도 비교과 프로그램 참가자 모집",
        textBody:
            "학생들의 진로와 역량 개발을 위한 비교과 프로그램 참가자를 모집합니다.",
        receivedAt: Timestamp.now(),
        externalMessageId: null,
        status: "ready",
        processedAt: Timestamp.now(),
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
        },
        draft: "학생들의 성장을 지원하는 비교과 프로그램 참가자를 모집합니다.",
    },
    {
        id: "career-training-mail",
        senderName: "미래직업교육원",
        senderAddress: "career@example.invalid",
        recipients: ["staff@example.com"],
        subject: "2026 하계 데이터 분석 직업훈련 참가자 모집",
        textBody:
            "취업 준비생을 위한 실무 중심 데이터 분석 직업훈련 참가자를 모집합니다.",
        receivedAt: Timestamp.now(),
        externalMessageId: null,
        status: "ready",
        processedAt: Timestamp.now(),
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
        },
        draft: "현직자 멘토링과 함께하는 데이터 분석 직업훈련 참가자를 모집합니다.",
    },
];

export function createFakeMailDataSource(items: MailItem[]): MailDataSource {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    return {
        initialItems: items,
        list: () => Promise.resolve([...items]),
        get: (id: string) => Promise.resolve(itemMap.get(id) ?? null),
        review: (item: MailItem, draft: string) =>
            Promise.resolve({
                ...item,
                status: "reviewed" as const,
                reviewedAt: Timestamp.now(),
                draft: draft.trim(),
            }),
    };
}

export const fakeMailSource = createFakeMailDataSource(inboxItems);
