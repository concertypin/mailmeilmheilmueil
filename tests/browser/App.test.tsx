import { Timestamp } from "firebase/firestore";
import { cleanup, render } from "vitest-browser-react/pure";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, expect, test, vi } from "vitest";
import { type MailItem } from "@/lib/mail-schema";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import MailReview from "@/pages/MailReview";
import App from "@/App";
import MailReviewPanel from "@/components/MailReviewPanel";
import { MailDataProvider } from "@/lib/mail-data";

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
        <MailDataProvider>
            <Router hook={hook} searchHook={searchHook}>
                <Home />
            </Router>
        </MailDataProvider>
    );
    await expect
        .element(screen.getByText("2026학년도 비교과 프로그램 참가자 모집"))
        .toBeVisible();
});

test("shows mail search and draft creation controls", async () => {
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    const screen = await render(
        <MailDataProvider>
            <Router hook={hook} searchHook={searchHook}>
                <App>
                    <Home />
                </App>
            </Router>
        </MailDataProvider>
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

test("filters the inbox by every AI metadata field", async () => {
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    const screen = await render(
        <MailDataProvider>
            <Router hook={hook} searchHook={searchHook}>
                <Home />
            </Router>
        </MailDataProvider>
    );
    const careerSubject = "2026 하계 데이터 분석 직업훈련 참가자 모집";
    const welcomeSubject = "2026학년도 비교과 프로그램 참가자 모집";
    const unprocessedSubject = "분석 진행 중인 산학협력 프로그램 안내";

    const unprocessedBody =
        "지역 기업과 함께하는 산학협력 프로그램 설명회와 현장실습 참가자를 안내합니다. 자세한 일정과 신청 방법은 분석이 완료되면 확인할 수 있습니다.";

    await expect.element(screen.getByText(unprocessedBody)).toBeVisible();
    await screen.getByRole("button", { name: "필터" }).click();
    for (const label of [
        "AI 분류",
        "AI 모집 대상",
        "AI 일정",
        "AI 혜택",
        "AI 신청 방법",
        "AI 문의/참고",
        "AI 검토 메모",
        "AI 홍보 초안 상태",
        "AI 신청 마감 시작일",
        "AI 신청 마감 종료일",
    ]) {
        await expect.element(screen.getByLabelText(label)).toBeVisible();
    }

    const textFilters = [
        ["AI 모집 대상", "취업 준비"],
        ["AI 일정", "8월 10일"],
        ["AI 혜택", "현직자 멘토링"],
        ["AI 신청 방법", "온라인 사전"],
        ["AI 문의/참고", "02-1234"],
        ["AI 검토 메모", "수료 혜택"],
    ] as const;
    for (const [label, value] of textFilters) {
        const input = screen.getByRole("searchbox", { name: label });
        await input.fill(value);
        await expect.element(screen.getByText(careerSubject)).toBeVisible();
        await expect
            .element(screen.getByText(welcomeSubject))
            .not.toBeInTheDocument();
        await input.fill("");
    }

    await screen
        .getByRole("combobox", { name: "AI 분류" })
        .selectOptions("직업훈련");
    await expect.element(screen.getByText(careerSubject)).toBeVisible();
    await expect
        .element(screen.getByText(welcomeSubject))
        .not.toBeInTheDocument();
    await screen.getByRole("button", { name: "필터 초기화" }).click();

    await screen
        .getByRole("textbox", { name: "AI 신청 마감 시작일" })
        .fill("2026-08-01");
    await screen
        .getByRole("textbox", { name: "AI 신청 마감 종료일" })
        .fill("2026-08-31");
    await expect.element(screen.getByText(careerSubject)).toBeVisible();
    await expect
        .element(screen.getByText(welcomeSubject))
        .not.toBeInTheDocument();
    await screen.getByRole("button", { name: "필터 초기화" }).click();

    await screen
        .getByRole("combobox", { name: "AI 홍보 초안 상태" })
        .selectOptions("generated");
    await expect.element(screen.getByText(careerSubject)).toBeVisible();
    await expect.element(screen.getByText(welcomeSubject)).toBeVisible();
    await expect
        .element(screen.getByText(unprocessedSubject))
        .not.toBeInTheDocument();
    await screen
        .getByRole("combobox", { name: "AI 홍보 초안 상태" })
        .selectOptions("missing");
    await expect.element(screen.getByText(unprocessedSubject)).toBeVisible();
    await expect
        .element(screen.getByText(careerSubject))
        .not.toBeInTheDocument();

    await screen
        .getByRole("combobox", { name: "AI 홍보 초안 상태" })
        .selectOptions("all");
    await screen
        .getByRole("searchbox", { name: "메일 검색" })
        .fill("현직자 멘토링");
    await expect.element(screen.getByText(careerSubject)).toBeVisible();
    await expect
        .element(screen.getByText(welcomeSubject))
        .not.toBeInTheDocument();
});

test("closes the login modal with the visible X icon", async () => {
    const screen = await render(<Landing />);

    await screen.getByRole("button", { name: "로그인", exact: true }).click();
    await expect
        .element(screen.getByRole("button", { name: "로그인 창 닫기" }))
        .toBeVisible();
    await screen.getByRole("button", { name: "로그인 창 닫기" }).click();
    await expect
        .element(screen.getByRole("button", { name: "로그인 창 닫기" }))
        .not.toBeInTheDocument();
});

test("omits reply actions from the mail detail view", async () => {
    const { hook, searchHook } = memoryLocation({
        path: "/mails/welcome-mail",
    });
    const screen = await render(
        <MailDataProvider>
            <Router hook={hook} searchHook={searchHook}>
                <MailReview />
            </Router>
        </MailDataProvider>
    );

    await expect
        .element(screen.getByRole("button", { name: "답장" }))
        .not.toBeInTheDocument();
    await expect
        .element(screen.getByRole("button", { name: "전체 답장" }))
        .not.toBeInTheDocument();
});
