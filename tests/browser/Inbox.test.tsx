// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { expect, test, vi } from "vitest";
import Home from "@/pages/Home";
import App from "@/App";
import { MailDataProvider } from "@/lib/mail-data";
import { fakeMailSource } from "@test/utils/test-data";
import { createMockLocalStorage } from "@test/utils/mock/localStorage";

test("shows the local mock inbox", () => {
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    render(
        <MailDataProvider source={fakeMailSource}>
            <Router hook={hook} searchHook={searchHook}>
                <Home />
            </Router>
        </MailDataProvider>
    );
    expect(
        screen.getByText("2026학년도 비교과 프로그램 참가자 모집")
    ).toBeVisible();
});

test("shows mail search and draft creation controls", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const user = userEvent.setup();
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    render(
        <MailDataProvider source={fakeMailSource}>
            <Router hook={hook} searchHook={searchHook}>
                <App>
                    <Home />
                </App>
            </Router>
        </MailDataProvider>
    );
    expect(screen.getByRole("heading", { name: "받은메일함" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /홍보 메일 검토/ }));
    expect(
        screen.getByRole("heading", { name: "홍보 메일 검토" })
    ).toBeVisible();
    expect(
        screen.getByRole("button", { name: "홍보 초안 작성" })
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /발송 대기/ }));
    expect(screen.getByRole("heading", { name: "발송대기함" })).toBeVisible();
});

test("shows sent mailbox with sent status items", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const user = userEvent.setup();
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    render(
        <MailDataProvider source={fakeMailSource}>
            <Router hook={hook} searchHook={searchHook}>
                <App>
                    <Home />
                </App>
            </Router>
        </MailDataProvider>
    );
    await user.click(screen.getByRole("button", { name: /보낸메일함/ }));
    expect(screen.getByRole("heading", { name: "보낸메일함" })).toBeVisible();
});

test("opens the filter panel and resets filters", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const user = userEvent.setup();
    const { hook, searchHook } = memoryLocation({ path: "/inbox" });
    render(
        <MailDataProvider source={fakeMailSource}>
            <Router hook={hook} searchHook={searchHook}>
                <App>
                    <Home />
                </App>
            </Router>
        </MailDataProvider>
    );

    // Dialog absent before clicking the filter button
    expect(screen.queryByRole("dialog", { name: "고급 필터" })).toBeNull();
    const filterButton = screen.getByRole("button", { name: "필터" });
    expect(filterButton).toHaveAttribute("aria-expanded", "false");

    // Click 필터 → compact popover opens with all controls
    await user.click(filterButton);
    expect(filterButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "고급 필터" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "보낸사람" })).toBeVisible();
    expect(screen.getByLabelText("수신일 시작일")).toBeVisible();
    expect(screen.getByLabelText("수신일 종료일")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "분류" })).toBeVisible();
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeVisible();

    // Select "직업훈련" category → only that fixture's mail is shown
    await user.selectOptions(
        screen.getByRole("combobox", { name: "분류" }),
        "직업훈련"
    );
    expect(
        screen.getByText("2026 하계 데이터 분석 직업훈련 참가자 모집")
    ).toBeVisible();
    expect(
        screen.queryByText("2026학년도 비교과 프로그램 참가자 모집")
    ).toBeNull();
    expect(screen.getByText("1 / 2")).toBeVisible();

    // Fill sender and date controls with nonempty values
    await user.type(
        screen.getByRole("searchbox", { name: "보낸사람" }),
        "테스트"
    );
    await user.type(screen.getByLabelText("수신일 시작일"), "2026-07-01");
    await user.type(screen.getByLabelText("수신일 종료일"), "2026-07-31");

    // Click 초기화 → all filter values reset
    await user.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(screen.getByRole("searchbox", { name: "보낸사람" })).toHaveValue("");
    expect(screen.getByLabelText("수신일 시작일")).toHaveValue("");
    expect(screen.getByLabelText("수신일 종료일")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "분류" })).toHaveValue("all");
    // Both fixture subjects reappear, header returns to 2 / 2
    expect(
        screen.getByText("2026학년도 비교과 프로그램 참가자 모집")
    ).toBeVisible();
    expect(
        screen.getByText("2026 하계 데이터 분석 직업훈련 참가자 모집")
    ).toBeVisible();
    expect(screen.getByText("2 / 2")).toBeVisible();

    // Toggle the same button again → popover closes
    await user.click(filterButton);
    expect(filterButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "고급 필터" })).toBeNull();
});
