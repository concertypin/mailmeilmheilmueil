import { Timestamp } from "firebase/firestore";
import { cleanup, render } from "vitest-browser-react/pure";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, expect, test, vi } from "vitest";
import { type MailItem } from "@/lib/mail-schema";
import Home from "@/pages/Home";
import App from "@/App";
import MailReviewPanel from "@/components/MailReviewPanel";

afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
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
    const screen = await render(
        <MailReviewPanel item={readyItem} onReview={() => Promise.resolve()} />
    );
    await expect.element(screen.getByText("미래직업교육원")).toBeVisible();
    await expect
        .element(
            screen.getByRole("heading", {
                name: "2026 여름 데이터 분석 직무교육 참가자 모집",
            })
        )
        .toBeVisible();
    await screen.getByRole("button", { name: /AI 분석 결과/ }).click();
    await expect.element(screen.getByText("직업훈련")).toBeVisible();
    await expect.element(screen.getByText("2026-07-31")).toBeVisible();
    await expect
        .element(screen.getByText("교육비 전액 지원, 수료증 발급"))
        .toBeVisible();
    await expect.element(screen.getByText("온라인 신청")).toBeVisible();
    await expect
        .element(
            screen.getByText("신청 페이지 주소와 문의처는 게시 전 확인 필요")
        )
        .toBeVisible();
    await expect
        .element(screen.getByRole("textbox", { name: "홍보 문안 초안" }))
        .toHaveValue("데이터 분석 직무교육 참가자를 모집합니다.");
    await expect
        .element(screen.getByRole("button", { name: "검토 완료" }))
        .toBeVisible();
});

test("shows the local mock inbox", async () => {
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    const screen = await render(
        <Router hook={hook} searchHook={searchHook}>
            <Home />
        </Router>
    );
    await expect
        .element(screen.getByText("2026학년도 비교과 프로그램 참가자 모집"))
        .toBeVisible();
});

test("shows mail search and draft creation controls", async () => {
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    const screen = await render(
        <Router hook={hook} searchHook={searchHook}>
            <App>
                <Home />
            </App>
        </Router>
    );
    await expect
        .element(screen.getByRole("heading", { name: "받은메일함" }))
        .toBeVisible();
    await screen.getByRole("button", { name: /홍보 메일 검토/ }).click();
    await expect
        .element(screen.getByRole("heading", { name: "홍보 메일 검토" }))
        .toBeVisible();
    await expect
        .element(screen.getByRole("button", { name: "홍보 초안 작성" }))
        .toBeDisabled();
    await screen.getByRole("button", { name: /발송 대기/ }).click();
    await expect
        .element(screen.getByRole("heading", { name: "발송대기함" }))
        .toBeVisible();
});
