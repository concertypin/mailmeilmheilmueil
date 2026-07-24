// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router, useLocation, useSearch } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { Timestamp } from "firebase/firestore";
import { expect, test } from "vitest";
import Dashboard from "@/pages/Dashboard";
import type { MailItem } from "@/lib/mail-schema";
import type { MailDataSource } from "@/lib/mail-data";
import { MailDataProvider } from "@/lib/mail-data";

const now = Timestamp.now();

const sevenItems: MailItem[] = [
    {
        id: "ready-1",
        senderName: "발신자1",
        senderAddress: "sender1@example.com",
        recipients: ["team@example.com"],
        subject: "Ready 1",
        textBody: "Content 1",
        receivedAt: now,
        externalMessageId: null,
        status: "ready",
        processedAt: now,
        reviewedAt: null,
        failureMessage: null,
        analysis: {
            category: "기타",
            audience: "전체",
            schedule: null,
            applicationDeadline: null,
            benefits: null,
            applicationMethod: null,
            contactOrReference: null,
            reviewNotes: [],
        },
        draft: null,
    },
    {
        id: "ready-2",
        senderName: "발신자2",
        senderAddress: "sender2@example.com",
        recipients: ["team@example.com"],
        subject: "Ready 2",
        textBody: "Content 2",
        receivedAt: now,
        externalMessageId: null,
        status: "ready",
        processedAt: now,
        reviewedAt: null,
        failureMessage: null,
        analysis: {
            category: "기타",
            audience: "전체",
            schedule: null,
            applicationDeadline: null,
            benefits: null,
            applicationMethod: null,
            contactOrReference: null,
            reviewNotes: [],
        },
        draft: null,
    },
    {
        id: "reviewed-1",
        senderName: "발신자3",
        senderAddress: "sender3@example.com",
        recipients: ["team@example.com"],
        subject: "Reviewed 1",
        textBody: "Content 3",
        receivedAt: now,
        externalMessageId: null,
        status: "reviewed",
        processedAt: now,
        reviewedAt: now,
        failureMessage: null,
        analysis: {
            category: "기타",
            audience: "전체",
            schedule: null,
            applicationDeadline: null,
            benefits: null,
            applicationMethod: null,
            contactOrReference: null,
            reviewNotes: [],
        },
        draft: "Draft content",
    },
    {
        id: "failed-1",
        senderName: "발신자4",
        senderAddress: "sender4@example.com",
        recipients: ["team@example.com"],
        subject: "Failed 1",
        textBody: "Content 4",
        receivedAt: now,
        externalMessageId: null,
        status: "failed",
        processedAt: now,
        reviewedAt: null,
        failureMessage: "Analysis failed",
        analysis: null,
        draft: null,
    },
    {
        id: "queued-1",
        senderName: "발신자5",
        senderAddress: "sender5@example.com",
        recipients: ["team@example.com"],
        subject: "Queued 1",
        textBody: "Content 5",
        receivedAt: now,
        externalMessageId: null,
        status: "queued",
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: null,
        draft: null,
    },
    {
        id: "processing-1",
        senderName: "발신자6",
        senderAddress: "sender6@example.com",
        recipients: ["team@example.com"],
        subject: "Processing 1",
        textBody: "Content 6",
        receivedAt: now,
        externalMessageId: null,
        status: "processing",
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: null,
        draft: null,
    },
    {
        id: "sent-1",
        senderName: "발신자7",
        senderAddress: "sender7@example.com",
        recipients: ["team@example.com"],
        subject: "Sent 1",
        textBody: "Content 7",
        receivedAt: now,
        externalMessageId: null,
        status: "sent",
        processedAt: null,
        reviewedAt: null,
        failureMessage: null,
        analysis: null,
        draft: "Sent draft",
    },
];

function createNeverResolvingSource(): MailDataSource {
    return {
        initialItems: null,
        list: () => new Promise(() => {}), // never resolves
        get: () => new Promise(() => {}),
        review: () => new Promise(() => {}),
        forceAnalysis: () => Promise.reject(new Error("not implemented")),
    };
}

function createRejectingSource(errorMessage: string): MailDataSource {
    return {
        initialItems: null,
        list: () => Promise.reject(new Error(errorMessage)),
        get: () => Promise.reject(new Error(errorMessage)),
        review: () => Promise.reject(new Error(errorMessage)),
        forceAnalysis: () => Promise.reject(new Error("not implemented")),
    };
}

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

test("shows seven-item fixture with correct dashboard counts", () => {
    const itemMap = new Map(sevenItems.map((i) => [i.id, i]));
    const source: MailDataSource = {
        initialItems: sevenItems,
        list: () => Promise.resolve([...sevenItems]),
        get: (id: string) => Promise.resolve(itemMap.get(id) ?? null),
        review: (item: MailItem, draft: string) =>
            Promise.resolve({
                ...item,
                status: "reviewed" as const,
                reviewedAt: Timestamp.now(),
                draft: draft.trim(),
            }),
        forceAnalysis: () => Promise.reject(new Error("not implemented")),
    };
    const { hook, searchHook } = memoryLocation({ path: "/dashboard" });
    render(
        <MailDataProvider source={source}>
            <Router hook={hook} searchHook={searchHook}>
                <Dashboard />
            </Router>
        </MailDataProvider>
    );

    expect(screen.getByRole("heading", { name: "대시보드" })).toBeVisible();
    expect(screen.getByLabelText("전체 메일: 7개")).toHaveTextContent("7");
    expect(screen.getByLabelText("처리 완료: 4개")).toHaveTextContent("4");
    expect(screen.getByLabelText("리뷰 필요: 2개")).toHaveTextContent("2");
    expect(screen.getByLabelText("분석 대기: 2개")).toHaveTextContent("2");
    expect(screen.getByLabelText("분석 실패: 1개")).toHaveTextContent("1");
});

test("clicking review link navigates to /inbox?folder=review", async () => {
    const user = userEvent.setup();
    const itemMap = new Map(sevenItems.map((i) => [i.id, i]));
    const source: MailDataSource = {
        initialItems: sevenItems,
        list: () => Promise.resolve([...sevenItems]),
        get: (id: string) => Promise.resolve(itemMap.get(id) ?? null),
        review: (item: MailItem, draft: string) =>
            Promise.resolve({
                ...item,
                status: "reviewed" as const,
                reviewedAt: Timestamp.now(),
                draft: draft.trim(),
            }),
        forceAnalysis: () => Promise.reject(new Error("not implemented")),
    };
    const { hook, searchHook } = memoryLocation({ path: "/dashboard" });
    render(
        <MailDataProvider source={source}>
            <Router hook={hook} searchHook={searchHook}>
                <Dashboard />
                <LocationProbe />
            </Router>
        </MailDataProvider>
    );

    await user.click(screen.getByRole("link", { name: "리뷰 필요 메일 확인" }));

    expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "/inbox?folder=review"
    );
});

test("shows loading alert when data is loading", () => {
    const { hook, searchHook } = memoryLocation({ path: "/dashboard" });
    render(
        <MailDataProvider source={createNeverResolvingSource()}>
            <Router hook={hook} searchHook={searchHook}>
                <Dashboard />
            </Router>
        </MailDataProvider>
    );

    expect(screen.getByText("메일 통계를 불러오는 중...")).toBeVisible();
});

test("shows error alert when data load fails", async () => {
    const { hook, searchHook } = memoryLocation({ path: "/dashboard" });
    render(
        <MailDataProvider source={createRejectingSource("Network failure")}>
            <Router hook={hook} searchHook={searchHook}>
                <Dashboard />
            </Router>
        </MailDataProvider>
    );

    expect(
        await screen.findByText(
            "메일 통계를 불러오지 못했습니다: Network failure"
        )
    ).toBeVisible();
});

test("shows empty state with zero counts when no items", () => {
    const source: MailDataSource = {
        initialItems: [],
        list: () => Promise.resolve([]),
        get: () => Promise.resolve(null),
        review: () => Promise.reject(new Error("no items")),
        forceAnalysis: () => Promise.reject(new Error("not implemented")),
    };
    const { hook, searchHook } = memoryLocation({ path: "/dashboard" });
    render(
        <MailDataProvider source={source}>
            <Router hook={hook} searchHook={searchHook}>
                <Dashboard />
            </Router>
        </MailDataProvider>
    );

    expect(
        screen.getByText(
            "표시할 메일이 없습니다. 메일함 동기화 후 다시 확인하세요."
        )
    ).toBeVisible();
    expect(screen.getByLabelText("전체 메일: 0개")).toHaveTextContent("0");
    expect(screen.getByLabelText("처리 완료: 0개")).toHaveTextContent("0");
    expect(screen.getByLabelText("리뷰 필요: 0개")).toHaveTextContent("0");
    expect(screen.getByLabelText("분석 대기: 0개")).toHaveTextContent("0");
    expect(screen.getByLabelText("분석 실패: 0개")).toHaveTextContent("0");
});
