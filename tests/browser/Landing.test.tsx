// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { expect, test } from "vitest";
import Landing from "@/pages/Landing";

test("closes the login modal with the visible X icon", async () => {
    const user = userEvent.setup();
    render(<Landing />);
    await user.click(screen.getAllByRole("button", { name: "로그인" })[0]!);
    expect(
        screen.getByRole("button", { name: "로그인 창 닫기" })
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "로그인 창 닫기" }));
    expect(
        screen.queryByRole("button", { name: "로그인 창 닫기" })
    ).not.toBeInTheDocument();
});

test("login modal: terms gate and form controls", async () => {
    const user = userEvent.setup();
    const { hook, searchHook } = memoryLocation({ path: "/" });
    render(
        <Router hook={hook} searchHook={searchHook}>
            <Landing />
        </Router>
    );

    await user.click(screen.getAllByRole("button", { name: "로그인" })[0]!);
    expect(
        screen.getByRole("heading", { name: "팀 메일함에 로그인" })
    ).toBeVisible();

    const dialog = screen.getByRole("dialog", { name: "팀 메일함에 로그인" });
    const submitBtn = dialog.querySelector('button[type="submit"]');
    expect(submitBtn).toBeDisabled();

    await user.click(
        screen.getByRole("checkbox", { name: "서비스 이용약관 동의" })
    );
    const emailInput = screen.getByPlaceholderText("team@example.com");
    await user.type(emailInput, "user@test.com");
    const passwordInput = screen.getByPlaceholderText("••••••••");
    await user.type(passwordInput, "password123");

    expect(submitBtn).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "로그인 창 닫기" }));
    expect(
        screen.queryByRole("button", { name: "로그인 창 닫기" })
    ).not.toBeInTheDocument();
});
