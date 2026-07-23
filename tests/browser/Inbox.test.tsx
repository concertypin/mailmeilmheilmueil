// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { expect, test } from "vitest";
import Home from "@/pages/Home";
import App from "@/App";
import { MailDataProvider } from "@/lib/mail-data";
import { fakeMailSource } from "@test/utils/test-data";

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

test("opens the AI filter panel and resets filters", async () => {
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

    await user.click(screen.getAllByRole("button", { name: "필터" })[0]!);
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "AI 분류" })).toBeVisible();
});
