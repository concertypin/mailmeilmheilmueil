// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { expect, test } from "vitest";
import MailReview from "@/pages/MailReview";
import { MailDataProvider } from "@/lib/mail-data";
import { fakeMailSource } from "@test/utils/test-data";

test("omits reply actions from the mail detail view", () => {
    const { hook, searchHook } = memoryLocation({
        path: "/mails/welcome-mail",
    });
    render(
        <MailDataProvider source={fakeMailSource}>
            <Router hook={hook} searchHook={searchHook}>
                <MailReview />
            </Router>
        </MailDataProvider>
    );

    expect(
        screen.queryByRole("button", { name: "답장" })
    ).not.toBeInTheDocument();
    expect(
        screen.queryByRole("button", { name: "전체 답장" })
    ).not.toBeInTheDocument();
});
