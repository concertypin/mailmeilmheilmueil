import { Timestamp } from "firebase/firestore";
import { cleanup, render } from "vitest-browser-react/pure";
import { afterEach, expect, test, vi } from "vitest";
import { type MailItem } from "@/lib/mail-schema";
import Home from "@/pages/Home";
import MailReviewPanel from "@/components/MailReviewPanel";

vi.mock("@/lib/firebase", () => ({
    subscribeToMailItems: (onItems: (items: MailItem[]) => void) => {
        onItems([]);
        return () => undefined;
    },
    subscribeToMailItem: () => () => undefined,
}));

afterEach(async () => {
    await cleanup();
});

const readyItem = {
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
        promotionDraft: "데이터 분석 직무교육 참가자를 모집합니다.",
    },
} satisfies MailItem;

test("shows original mail, structured analysis, draft, warning, and review action", async () => {
    const screen = await render(<MailReviewPanel item={readyItem} onReview={() => Promise.resolve()} />);
    await expect.element(screen.getByText("미래직업교육원")).toBeVisible();
    await expect.element(screen.getByRole("heading", { name: "2026 여름 데이터 분석 직무교육 참가자 모집" })).toBeVisible();
    await expect.element(screen.getByText("직업훈련")).toBeVisible();
    await expect.element(screen.getByText("2026-07-31")).toBeVisible();
    await expect.element(screen.getByText("교육비 전액 지원, 수료증 발급")).toBeVisible();
    await expect.element(screen.getByText("온라인 신청")).toBeVisible();
    await expect.element(screen.getByText("신청 페이지 주소와 문의처는 게시 전 확인 필요")).toBeVisible();
    await expect.element(screen.getByText("데이터 분석 직무교육 참가자를 모집합니다.")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "검토 완료로 표시" })).toBeVisible();
});

test("shows the exact empty inbox message", async () => {
    const screen = await render(<Home />);
    await expect.element(screen.getByText("아직 수신된 메일이 없습니다. 테스트 메일을 보내면 여기에서 검토할 수 있습니다.")).toBeVisible();
});
