// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router, useLocation, useSearch } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { expect, test, vi } from "vitest";
import { createMockLocalStorage } from "@test/utils/mock/localStorage";
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

test("login modal: email+password enables submit button", async () => {
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

    const emailInput = screen.getByPlaceholderText("학번");
    await user.type(emailInput, "510130340");
    const passwordInput = screen.getByPlaceholderText("••••••••");
    await user.type(passwordInput, "password123");

    expect(submitBtn).toBeEnabled();

    expect(screen.getByText("@kangnam.ac.kr")).toBeInTheDocument();
    expect(
        screen.getByText("계속하면 이용약관에 동의하는 것으로 간주합니다.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "로그인 창 닫기" }));
    expect(
        screen.queryByRole("button", { name: "로그인 창 닫기" })
    ).not.toBeInTheDocument();
});

function LocationProbe() {
    const [location] = useLocation();
    const search = useSearch();
    return (
        <div data-testid="location-probe">
            {location}
            {search ? `?${search}` : ""}
        </div>
    );
}

test("successful normal login redirects to /dashboard", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const user = userEvent.setup();
    const { hook, searchHook } = memoryLocation({ path: "/" });

    const fetchMock = vi
        .fn<(...args: unknown[]) => Promise<Response>>()
        .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
        <Router hook={hook} searchHook={searchHook}>
            <Landing />
            <LocationProbe />
        </Router>
    );

    await user.click(screen.getAllByRole("button", { name: "로그인" })[0]!);

    const emailInput = screen.getByPlaceholderText("학번");
    await user.type(emailInput, "510130340");
    const passwordInput = screen.getByPlaceholderText("••••••••");
    await user.type(passwordInput, "password123");

    const dialog = screen.getByRole("dialog", { name: "팀 메일함에 로그인" });
    const submitBtn = dialog.querySelector('button[type="submit"]')!;
    await user.click(submitBtn);

    expect(await screen.findByTestId("location-probe")).toHaveTextContent(
        "/dashboard"
    );

    vi.unstubAllGlobals();
});

test("successful test login redirects to /dashboard", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const user = userEvent.setup();
    const { hook, searchHook } = memoryLocation({ path: "/" });

    const testAccountBody = JSON.stringify({
        account: "test@kangnam.ac.kr",
        password: "test-password",
    });
    const fetchMock = vi
        .fn<(...args: unknown[]) => Promise<Response>>()
        .mockResolvedValue(new Response(testAccountBody, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
        <Router hook={hook} searchHook={searchHook}>
            <Landing />
            <LocationProbe />
        </Router>
    );

    // Open login modal first, then click test account button inside it
    await user.click(screen.getAllByRole("button", { name: "로그인" })[0]!);
    await user.click(screen.getByRole("button", { name: "테스트 계정" }));

    expect(await screen.findByTestId("location-probe")).toHaveTextContent(
        "/dashboard"
    );

    vi.unstubAllGlobals();
});
