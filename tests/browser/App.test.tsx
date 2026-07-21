import { Timestamp } from "firebase/firestore";
import { cleanup, render } from "vitest-browser-react/pure";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { type MailItem } from "@/lib/mail-schema";
import Home from "@/pages/Home";
import App from "@/App";
import MailReviewPanel from "@/components/MailReviewPanel";
import Login from "@/pages/Login";

vi.mock("@/lib/firebase", () => ({
    subscribeToMailItems: (onItems: (items: MailItem[]) => void) => {
        onItems([]);
        return () => undefined;
    },
    subscribeToMailItem: () => () => undefined,
}));

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
        .element(screen.getByText("데이터 분석 직무교육 참가자를 모집합니다."))
        .toBeVisible();
    await expect
        .element(screen.getByRole("button", { name: "검토 완료로 표시" }))
        .toBeVisible();
});

test("shows the exact empty inbox message", async () => {
    const screen = await render(<Home />);
    await expect
        .element(
            screen.getByText(
                "아직 수신된 메일이 없습니다. 테스트 메일을 보내면 여기에서 검토할 수 있습니다."
            )
        )
        .toBeVisible();
});

test("shows the Kangnam mail login form", async () => {
    const screen = await render(
        <MemoryRouter>
            <Login />
        </MemoryRouter>
    );
    await expect
        .element(
            screen.getByRole("heading", { name: "강남대학교 메일 로그인" })
        )
        .toBeVisible();
    await expect.element(screen.getByLabelText("강남대 ID")).toBeVisible();
    await expect
        .element(screen.getByLabelText("비밀번호"))
        .toHaveAttribute("type", "password");
    await expect
        .element(screen.getByText("mail.kangnam.ac.kr:993 (IMAP SSL/TLS)"))
        .toBeVisible();
    await expect
        .element(screen.getByRole("button", { name: "메일함 연결" }))
        .toBeVisible();
    await expect
        .element(screen.getByRole("link", { name: "테스트 메일함으로 계속" }))
        .toHaveAttribute("href", "/");
});

test("submits IMAP credentials without browser storage and clears the password", async () => {
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
            new Response(
                JSON.stringify({ account: "test-user@kangnam.ac.kr" }),
                { status: 200 }
            )
        );
    const screen = await render(
        <MemoryRouter>
            <Login />
        </MemoryRouter>
    );
    const password = screen.getByLabelText("비밀번호");
    await screen.getByLabelText("강남대 ID").fill("test-user");
    await password.fill("test-password");
    await screen.getByRole("button", { name: "메일함 연결" }).click();
    await expect.element(password).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledWith(
        "/api/imap/login",
        expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
                portalId: "test-user",
                password: "test-password",
            }),
        })
    );
    expect(localStorage.getItem("imapSession")).toBeNull();
    expect(sessionStorage.getItem("imapSession")).toBeNull();
});

test("syncs the inbox with same-origin credentials and shows the result", async () => {
    const { promise, resolve } = Promise.withResolvers<Response>();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(promise);
    const screen = await render(<Home />);
    const button = screen.getByRole("button", { name: "메일 동기화" });
    await button.click();
    await expect.element(button).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith("/api/imap/sync", {
        method: "POST",
        credentials: "same-origin",
    });
    resolve(
        new Response(
            JSON.stringify({ imported: 2, duplicates: 1, rejected: 0 }),
            { status: 200 }
        )
    );
    await expect
        .element(
            screen.getByText(
                "가져온 메일 2건 · 이미 처리된 메일 1건 · 제외된 메일 0건"
            )
        )
        .toBeVisible();
});

test("shows a login link when the IMAP session expires", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "expired" }), { status: 401 })
    );
    const screen = await render(
        <MemoryRouter>
            <Home />
        </MemoryRouter>
    );
    await screen.getByRole("button", { name: "메일 동기화" }).click();
    await expect
        .element(
            screen.getByText(
                "메일 연결이 만료되었습니다. 다시 로그인해 주세요."
            )
        )
        .toBeVisible();
    await expect
        .element(screen.getByRole("link", { name: "로그인 페이지로 이동" }))
        .toHaveAttribute("href", "/login");
});

test("shows the Kangnam login entry point in the app header", async () => {
    const screen = await render(
        <MemoryRouter>
            <App />
        </MemoryRouter>
    );
    await expect
        .element(screen.getByRole("link", { name: "강남대 메일 로그인" }))
        .toHaveAttribute("href", "/login");
});
