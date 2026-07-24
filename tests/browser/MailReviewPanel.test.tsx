// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import MailReviewPanel from "@/components/MailReviewPanel";
import { readyItem } from "@test/utils/test-data";
import { AnalysisCriteriaProvider } from "@/lib/analysis-criteria-data";

test("shows original mail, structured analysis, draft, warning, and review action", async () => {
    const user = userEvent.setup();
    render(
        <AnalysisCriteriaProvider>
            <MailReviewPanel
                item={readyItem}
                onReview={() => Promise.resolve()}
            />
        </AnalysisCriteriaProvider>
    );
    expect(screen.getByText("미래직업교육원", { exact: false })).toBeVisible();
    expect(
        screen.getByRole("heading", {
            name: "2026 여름 데이터 분석 직무교육 참가자 모집",
        })
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /AI 분석 결과/ }));
    expect(screen.getByText("2026-07-31")).toBeVisible();
    expect(screen.getByText("교육비 전액 지원, 수료증 발급")).toBeVisible();
    expect(screen.getByText("온라인 신청")).toBeVisible();
    expect(
        screen.getByText("신청 페이지 주소와 문의처는 게시 전 확인 필요")
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "홍보 문안 초안" })).toHaveValue(
        "데이터 분석 직무교육 참가자를 모집합니다."
    );
    expect(screen.getByRole("button", { name: "검토 완료" })).toBeVisible();
});
