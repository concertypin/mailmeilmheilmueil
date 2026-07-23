// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Compose from "@/pages/Compose";
import Contacts from "@/pages/Contacts";
import App from "@/App";
import { MailDataProvider } from "@/lib/mail-data";
import { AddressBookProvider } from "@/lib/contact-book-data";
import { fakeMailSource, CONTACT_BOOK_KEY } from "@test/utils/test-data";
import { createMockLocalStorage } from "@test/utils/mock/localStorage";

let mockStorage: Storage;

beforeEach(() => {
    mockStorage = createMockLocalStorage();
    vi.stubGlobal("localStorage", mockStorage);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

test("creates a contact and renders it in the contact list", async () => {
    const user = userEvent.setup();
    const { hook, searchHook } = memoryLocation({ path: "/contacts" });
    render(
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

    expect(screen.getByRole("textbox", { name: "별칭" })).toBeVisible();

    await user.type(screen.getByRole("textbox", { name: "별칭" }), "민수");
    await user.type(
        screen.getByRole("textbox", { name: "이메일" }),
        "minsu@example.com"
    );
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByRole("cell", { name: "민수" })).toBeVisible();
    expect(
        screen.getByRole("cell", { name: "minsu@example.com" })
    ).toBeVisible();
});

test("compose page resolves contact and group into To/Bcc", async () => {
    const user = userEvent.setup();
    const testBook = {
        contacts: [
            { id: "c1", alias: "민수", email: "minsu@example.com" },
            { id: "c2", alias: "지수", email: "jisu@example.com" },
        ],
        groups: [{ id: "g1", name: "솦공", memberIds: ["c1", "c2"] }],
    };
    mockStorage.setItem(CONTACT_BOOK_KEY, JSON.stringify(testBook));

    const { hook, searchHook } = memoryLocation({ path: "/compose" });
    render(
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

    await user.click(
        screen.getByRole("button", {
            name: "민수 <minsu@example.com>",
        })
    );

    await user.click(screen.getByRole("button", { name: /^솦공.*/ }));

    expect(screen.getByText("받는 사람 (To)")).toBeVisible();
    expect(screen.getByText("숨은 참조 (Bcc)")).toBeVisible();
    expect(screen.getByText(/1명/)).toBeVisible();

    await user.type(
        screen.getByPlaceholderText("메일 제목을 입력해주세요."),
        "테스트 제목"
    );
    await user.type(
        screen.getByPlaceholderText("메일 내용을 입력해주세요."),
        "테스트 내용입니다."
    );

    await user.click(screen.getByRole("button", { name: "발송" }));

    expect(screen.queryByText("발송되었습니다")).not.toBeInTheDocument();
});

test("contacts page shows seed contacts without localStorage seeding", () => {
    mockStorage.removeItem(CONTACT_BOOK_KEY);

    const { hook, searchHook } = memoryLocation({ path: "/contacts" });
    render(
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

    expect(
        screen.getAllByRole("cell", { name: "학생 홍보팀" })[0]
    ).toBeVisible();
    expect(
        screen.getAllByRole("cell", { name: "학생지원팀" })[0]
    ).toBeVisible();
});
