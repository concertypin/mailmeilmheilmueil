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
import { MailDataProvider, type MailDataSource } from "@/lib/mail-data";
import { AddressBookProvider } from "@/lib/contact-book-data";
import Compose from "@/pages/Compose";
import Contacts from "@/pages/Contacts";

const CONTACT_BOOK_KEY = "mailmeilmheilmueil.contact-book.v1";

afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
    try {
        localStorage.removeItem(CONTACT_BOOK_KEY);
    } catch {
        // Browser test environment may not always support localStorage
    }
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

const inboxItems: MailItem[] = [
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
            promotionDraft:
                "현직자 멘토링과 함께하는 데이터 분석 직업훈련 참가자를 모집합니다.",
        },
    },
];

function createFakeMailDataSource(items: MailItem[]): MailDataSource {
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
                analysis: item.analysis
                    ? { ...item.analysis, promotionDraft: draft.trim() }
                    : item.analysis,
            }),
    };
}

const fakeMailSource = createFakeMailDataSource(inboxItems);

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
        <MailDataProvider source={fakeMailSource}>
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
        <MailDataProvider source={fakeMailSource}>
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

test("opens the AI filter panel and resets filters", async () => {
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    const screen = await render(
        <MailDataProvider source={fakeMailSource}>
            <Router hook={hook} searchHook={searchHook}>
                <App>
                    <Home />
                </App>
            </Router>
        </MailDataProvider>
    );

    // Open the filter panel
    await screen.getByRole("button", { name: "필터" }).click();

    // The filter reset button should now be visible
    await expect
        .element(screen.getByRole("button", { name: "필터 초기화" }))
        .toBeVisible();

    // Verify the category filter select exists
    await expect
        .element(screen.getByRole("combobox", { name: "AI 분류" }))
        .toBeVisible();
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
        <MailDataProvider source={fakeMailSource}>
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

// ── Contact-book / address-book tests ────────────────────────────────

test("creates a contact and renders it in the contact list", async () => {
    const { hook, searchHook } = memoryLocation({ path: "/contacts" });
    const screen = await render(
        <MailDataProvider source={fakeMailSource}>
            <AddressBookProvider>
                <Router hook={hook} searchHook={searchHook}>
                    <App>
                        <Contacts />
                    </App>
                </Router>
            </AddressBookProvider>
        </MailDataProvider>
    );

    await expect
        .element(screen.getByRole("textbox", { name: "별칭" }))
        .toBeVisible();

    await screen.getByRole("textbox", { name: "별칭" }).fill("민수");
    await screen
        .getByRole("textbox", { name: "이메일" })
        .fill("minsu@example.com");
    await screen.getByRole("button", { name: "추가", exact: true }).click();

    await expect
        .element(screen.getByRole("cell", { name: "민수", exact: true }))
        .toBeVisible();
    await expect
        .element(
            screen.getByRole("cell", { name: "minsu@example.com", exact: true })
        )
        .toBeVisible();
});

test("compose page resolves contact and group into To/Bcc", async () => {
    const testBook = {
        contacts: [
            { id: "c1", alias: "민수", email: "minsu@example.com" },
            { id: "c2", alias: "지수", email: "jisu@example.com" },
        ],
        groups: [{ id: "g1", name: "솦공", memberIds: ["c1", "c2"] }],
    };
    localStorage.setItem(CONTACT_BOOK_KEY, JSON.stringify(testBook));

    const { hook, searchHook } = memoryLocation({ path: "/compose" });
    const screen = await render(
        <MailDataProvider source={fakeMailSource}>
            <AddressBookProvider>
                <Router hook={hook} searchHook={searchHook}>
                    <App>
                        <Compose />
                    </App>
                </Router>
            </AddressBookProvider>
        </MailDataProvider>
    );

    // Select 민수 as a direct contact
    await screen
        .getByRole("button", {
            name: "민수 <minsu@example.com>",
            exact: true,
        })
        .click();

    // Select 솦공 group
    await screen.getByRole("button", { name: /^솦공.*/ }).click();

    await expect.element(screen.getByText("받는 사람 (To)")).toBeVisible();
    await expect.element(screen.getByText("숨은 참조 (Bcc)")).toBeVisible();
    await expect.element(screen.getByText(/1명/)).toBeVisible();

    await screen
        .getByPlaceholder("메일 제목을 입력해주세요.")
        .fill("테스트 제목");
    await screen
        .getByPlaceholder("메일 내용을 입력해주세요.")
        .fill("테스트 내용입니다.");

    await screen.getByRole("button", { name: "발송 준비" }).click();

    // P3a: no infrastructure notice shown since the app is always API-backed
    // P1b will wire up the actual send

    await expect
        .element(screen.getByText("발송되었습니다"))
        .not.toBeInTheDocument();
});

test("contacts page shows seed contacts without localStorage seeding", async () => {
    localStorage.removeItem(CONTACT_BOOK_KEY);

    const { hook, searchHook } = memoryLocation({ path: "/contacts" });
    const screen = await render(
        <MailDataProvider source={fakeMailSource}>
            <AddressBookProvider>
                <Router hook={hook} searchHook={searchHook}>
                    <App>
                        <Contacts />
                    </App>
                </Router>
            </AddressBookProvider>
        </MailDataProvider>
    );

    // Use .first() to match the first table cell (the alias name)
    await expect
        .element(screen.getByRole("cell", { name: "학생 홍보팀" }).first())
        .toBeVisible();
    await expect
        .element(screen.getByRole("cell", { name: "학생지원팀" }).first())
        .toBeVisible();
});

test("login modal: terms gate and form controls", async () => {
    const { hook, searchHook } = memoryLocation({ path: "/" });
    const screen = await render(
        <Router hook={hook} searchHook={searchHook}>
            <Landing />
        </Router>
    );

    // Open the login modal
    await screen.getByRole("button", { name: "로그인", exact: true }).click();
    await expect
        .element(screen.getByRole("heading", { name: "팀 메일함에 로그인" }))
        .toBeVisible();
    // Submit button is disabled when terms not agreed
    // The submit button is the one inside the dialog, type="submit"
    const dialog = screen.getByRole("dialog", { name: "팀 메일함에 로그인" });
    const submitBtn = dialog.getByRole("button", {
        name: "로그인",
        exact: true,
    });
    await expect.element(submitBtn).toBeDisabled();

    // Agree to terms, add credentials - button becomes enabled
    await screen
        .getByRole("checkbox", { name: "서비스 이용약관 동의" })
        .click();
    const emailInput = screen.getByPlaceholder("team@example.com");
    await emailInput.fill("user@test.com");
    const passwordInput = screen.getByPlaceholder("••••••••");
    await passwordInput.fill("password123");

    await expect.element(submitBtn).toBeEnabled();

    // Close button works
    await screen.getByRole("button", { name: "로그인 창 닫기" }).click();
    await expect
        .element(screen.getByRole("button", { name: "로그인 창 닫기" }))
        .not.toBeInTheDocument();
});
