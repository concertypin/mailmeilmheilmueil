import { useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "wouter";
import {
    encodeImapBasicAuthorization,
    saveImapBasicCredentials,
} from "@/lib/imap-basic";

const featureCards = [
    {
        eyebrow: "MAIL REVIEW",
        title: "중요한 안내 메일을\n한 곳에서 검토",
        description:
            "수신된 프로그램·행사 안내를 모아 홍보에 필요한 정보를 빠르게 확인합니다.",
        artwork: (
            <div className="rounded-2xl bg-base-100 p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" />
                    <span className="h-2 w-20 rounded-full bg-base-300" />
                </div>
                <div className="space-y-2">
                    {["접수 마감일", "참가 대상", "홍보 초안"].map((label) => (
                        <div
                            className="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2 text-xs"
                            key={label}
                        >
                            <span>{label}</span>
                            <span className="badge badge-sm">확인</span>
                        </div>
                    ))}
                </div>
            </div>
        ),
    },
    {
        eyebrow: "TEAMWORK",
        title: "팀과 함께\n놓치지 않는 검토 흐름",
        description:
            "검토 대기와 완료 상태를 한눈에 보고 다음 홍보 작업을 이어갑니다.",
        artwork: (
            <div className="flex h-full items-end gap-2 px-5 pt-8">
                {[42, 65, 88, 116].map((height, index) => (
                    <div className="flex-1" key={height}>
                        <div
                            className="rounded-t-lg bg-primary/80"
                            style={{ height: `${height}px` }}
                        />
                        <div className="mx-auto mt-2 h-1.5 w-6 rounded-full bg-base-300" />
                        {index === 3 ? null : <div className="h-3" />}
                    </div>
                ))}
            </div>
        ),
    },
    {
        eyebrow: "PROMOTION",
        title: "바로 다듬어 쓸 수 있는\n홍보 초안",
        description:
            "메일 내용을 읽고, 핵심 일정과 혜택을 구조화해 검토를 돕습니다.",
        artwork: (
            <div className="space-y-3 rounded-2xl bg-base-100 p-5 shadow-sm">
                <div className="h-3 w-2/3 rounded-full bg-base-content/70" />
                <div className="h-2 w-full rounded-full bg-base-300" />
                <div className="h-2 w-4/5 rounded-full bg-base-300" />
                <div className="mt-5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-content">
                    홍보 문구 검토 준비 완료
                </div>
            </div>
        ),
    },
    {
        eyebrow: "SIMPLE",
        title: "복잡한 설정 없이\n피드백에만 집중",
        description:
            "API 서버에서 메일 데이터를 불러와 빠르게 검토할 수 있습니다.",
        artwork: (
            <div className="grid grid-cols-2 gap-3 p-3">
                {["메일", "분석", "검토", "완료"].map((label, index) => (
                    <div
                        className={`grid aspect-square place-items-center rounded-2xl text-sm font-semibold ${
                            index === 2
                                ? "bg-primary text-primary-content"
                                : "bg-base-100"
                        }`}
                        key={label}
                    >
                        {label}
                    </div>
                ))}
            </div>
        ),
    },
];

export default function Landing() {
    const [, setLocation] = useLocation();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
    const [account, setAccount] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    const canSubmit =
        hasAgreedToTerms &&
        account.trim().length > 0 &&
        password.length > 0 &&
        !isSubmitting;

    const handleLogin = async () => {
        if (!canSubmit) return;
        setIsSubmitting(true);
        setLoginError(null);

        try {
            const authHeader = encodeImapBasicAuthorization(
                account.trim(),
                password
            );
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { authorization: authHeader },
            });

            if (response.status === 204) {
                saveImapBasicCredentials({
                    account: account.trim(),
                    password,
                });
                setLocation("/inbox");
                return;
            }

            const body: unknown = await response.json();
            let message = "로그인에 실패했습니다. 다시 시도해 주세요.";
            if (
                typeof body === "object" &&
                body !== null &&
                "error" in body &&
                typeof body.error === "string"
            ) {
                message = body.error;
            }
            setLoginError(message);
        } catch {
            setLoginError("로그인에 실패했습니다. 다시 시도해 주세요.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-base-100 text-base-content">
            <header className="sticky top-0 z-20 border-b border-base-300/70 bg-base-100/95 backdrop-blur">
                <div className="navbar mx-auto min-h-16 max-w-7xl px-5 sm:px-8">
                    <div className="navbar-start">
                        <Link
                            className="text-xl font-bold tracking-tight"
                            href="/"
                        >
                            메일렌즈
                        </Link>
                    </div>
                    <div className="navbar-center hidden gap-8 text-sm text-base-content/70 lg:flex">
                        <a href="#overview">서비스 소개</a>
                        <a href="#features">주요 기능</a>
                        <a href="#flow">이용 흐름</a>
                    </div>
                    <div className="navbar-end gap-2">
                        <button
                            className="btn btn-ghost btn-sm hidden sm:inline-flex"
                            type="button"
                        >
                            도움말
                        </button>
                        <button
                            className="btn btn-neutral btn-sm rounded-full px-5"
                            onClick={() => setIsLoginOpen(true)}
                            type="button"
                        >
                            로그인
                        </button>
                    </div>
                </div>
            </header>

            <main>
                <section
                    className="relative isolate px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28"
                    id="overview"
                >
                    <div className="absolute inset-x-0 top-20 -z-10 mx-auto h-80 max-w-4xl animate-pulse rounded-full bg-primary/10 blur-3xl motion-reduce:animate-none" />
                    <div className="mx-auto max-w-5xl text-center">
                        <p className="text-sm font-semibold tracking-[0.18em] text-primary">
                            MAIL LENS
                        </p>
                        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                            팀의 중요한 메일을
                            <br />
                            <span className="text-primary">
                                더 선명하게 검토하세요.
                            </span>
                        </h1>
                        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-base-content/65 sm:text-lg">
                            수신함에서 놓치기 쉬운 안내 메일을 모아,
                            <br className="hidden sm:block" />
                            팀이 함께 확인할 수 있는 홍보 검토 흐름으로
                            정리합니다.
                        </p>
                        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                            <button
                                className="btn btn-primary btn-lg rounded-full px-8 transition duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none"
                                onClick={() => setIsLoginOpen(true)}
                                type="button"
                            >
                                메일함 시작하기
                            </button>
                            <a
                                className="btn btn-outline btn-lg rounded-full px-8 transition duration-300 hover:-translate-y-1 motion-reduce:transform-none"
                                href="#features"
                            >
                                기능 둘러보기
                            </a>
                        </div>
                    </div>

                    <div className="mx-auto mt-16 max-w-5xl rounded-[2rem] border border-base-300 bg-base-200 p-3 shadow-2xl shadow-base-content/10 sm:p-5">
                        <div className="overflow-hidden rounded-[1.5rem] bg-base-100">
                            <div className="flex items-center gap-2 border-b border-base-300 px-5 py-4">
                                <span className="size-2.5 rounded-full bg-error/70" />
                                <span className="size-2.5 rounded-full bg-warning/70" />
                                <span className="size-2.5 rounded-full bg-success/70" />
                                <div className="ml-3 h-6 w-44 rounded-full bg-base-200" />
                            </div>
                            <div className="grid min-h-80 grid-cols-[72px_1fr] sm:min-h-105 sm:grid-cols-[160px_1fr]">
                                <aside className="border-r border-base-300 bg-base-200 p-3 sm:p-5">
                                    <div className="h-6 w-8 rounded bg-primary sm:w-20" />
                                    <div className="mt-7 space-y-3">
                                        {[1, 2, 3, 4].map((line) => (
                                            <div
                                                className="h-2 rounded-full bg-base-300"
                                                key={line}
                                            />
                                        ))}
                                    </div>
                                </aside>
                                <div className="p-5 sm:p-9">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-medium text-primary">
                                                검토 대기
                                            </p>
                                            <h2 className="mt-2 text-xl font-semibold sm:text-3xl">
                                                2026학년도 비교과 프로그램
                                                참가자 모집
                                            </h2>
                                        </div>
                                        <span className="badge badge-primary badge-outline hidden sm:inline-flex">
                                            중요
                                        </span>
                                    </div>
                                    <div className="mt-7 grid gap-3 sm:grid-cols-3">
                                        {[
                                            ["모집 대상", "재학생"],
                                            ["신청 마감", "07.31"],
                                            ["검토 상태", "준비 완료"],
                                        ].map(([label, value]) => (
                                            <div
                                                className="rounded-xl bg-base-200 p-4"
                                                key={label}
                                            >
                                                <p className="text-xs text-base-content/60">
                                                    {label}
                                                </p>
                                                <p className="mt-1 font-semibold">
                                                    {value}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm">
                                        홍보 초안과 확인이 필요한 정보를 팀과
                                        함께 검토하세요.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className="border-y border-base-300 bg-base-200 px-5 py-20 sm:px-8 sm:py-28"
                    id="features"
                >
                    <div className="mx-auto max-w-5xl">
                        <p className="text-sm font-semibold tracking-[0.18em] text-primary">
                            WORKFLOW
                        </p>
                        <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">
                            중요한 메일을 놓치지 않는
                            <br />
                            팀의 검토 환경
                        </h2>
                        <div className="mt-12 grid gap-5 md:grid-cols-2">
                            {featureCards.map((feature, index) => (
                                <article
                                    className={`card border border-base-300 bg-base-100 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none ${
                                        index === 0 ? "md:row-span-2" : ""
                                    }`}
                                    key={feature.eyebrow}
                                >
                                    <div className="card-body gap-4 p-7 sm:p-8">
                                        <p className="text-xs font-semibold tracking-[0.16em] text-primary">
                                            {feature.eyebrow}
                                        </p>
                                        <h3 className="card-title whitespace-pre-line text-2xl leading-tight">
                                            {feature.title}
                                        </h3>
                                        <p className="max-w-sm leading-6 text-base-content/65">
                                            {feature.description}
                                        </p>
                                        <div className="mt-auto min-h-40 overflow-hidden rounded-2xl bg-base-200">
                                            {feature.artwork}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-5 py-20 sm:px-8 sm:py-28" id="flow">
                    <div className="mx-auto max-w-5xl rounded-[2rem] bg-neutral px-7 py-12 text-neutral-content sm:px-14 sm:py-16">
                        <p className="text-sm font-semibold tracking-[0.18em] text-primary">
                            GET STARTED
                        </p>
                        <div className="mt-4 flex flex-col justify-between gap-8 md:flex-row md:items-end">
                            <div>
                                <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                                    팀의 UX 플로우를
                                    <br />
                                    바로 확인해 보세요.
                                </h2>
                                <p className="mt-5 max-w-lg leading-7 text-neutral-content/70">
                                    로그인 후 로컬 목업 메일함에서 목록, 상세,
                                    검토 완료 흐름을 확인할 수 있습니다.
                                </p>
                            </div>
                            <button
                                className="btn btn-primary btn-lg rounded-full px-8"
                                onClick={() => setIsLoginOpen(true)}
                                type="button"
                            >
                                로그인하고 시작하기
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            {isLoginOpen ? (
                <div
                    className="modal modal-open"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="login-title"
                >
                    <div className="modal-box max-w-md">
                        <button
                            className="btn btn-md btn-circle btn-ghost absolute right-3 top-3"
                            aria-label="로그인 창 닫기"
                            onClick={() => setIsLoginOpen(false)}
                            type="button"
                        >
                            <XIcon aria-hidden="true" size={22} weight="bold" />
                        </button>
                        <p className="text-sm font-semibold tracking-[0.16em] text-primary">
                            MAIL LENS
                        </p>
                        <h2
                            className="mt-3 text-2xl font-semibold"
                            id="login-title"
                        >
                            팀 메일함에 로그인
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-base-content/65">
                            IMAP 계정으로 로그인하여 메일함을 불러옵니다.
                        </p>
                        <div className="mt-7 space-y-3">
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleLogin();
                                }}
                            >
                                <div className="mt-7 space-y-3">
                                    <label className="fieldset">
                                        <span className="label">이메일</span>
                                        <input
                                            className="input w-full"
                                            onChange={(event) =>
                                                setAccount(
                                                    event.currentTarget.value
                                                )
                                            }
                                            placeholder="team@example.com"
                                            type="email"
                                            value={account}
                                        />
                                    </label>
                                    <label className="fieldset">
                                        <span className="label">비밀번호</span>
                                        <input
                                            className="input w-full"
                                            onChange={(event) =>
                                                setPassword(
                                                    event.currentTarget.value
                                                )
                                            }
                                            placeholder="••••••••"
                                            type="password"
                                            value={password}
                                        />
                                    </label>
                                </div>
                                {loginError ? (
                                    <div
                                        className="alert alert-error mt-4"
                                        role="alert"
                                    >
                                        <span>{loginError}</span>
                                    </div>
                                ) : null}
                                <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
                                    <input
                                        aria-label="서비스 이용약관 동의"
                                        checked={hasAgreedToTerms}
                                        className="checkbox checkbox-primary checkbox-sm"
                                        onChange={(event) =>
                                            setHasAgreedToTerms(
                                                event.currentTarget.checked
                                            )
                                        }
                                        type="checkbox"
                                    />
                                    <span>
                                        서비스 이용약관 및 개인정보 처리방침에
                                        동의합니다. (필수)
                                    </span>
                                </label>
                                <div className="modal-action mt-7 flex-col sm:flex-row">
                                    <button
                                        className="btn btn-ghost order-2 sm:order-1"
                                        onClick={() => setIsLoginOpen(false)}
                                        type="button"
                                    >
                                        취소
                                    </button>
                                    <button
                                        className="btn btn-primary order-1 sm:order-2"
                                        disabled={!canSubmit}
                                        type="submit"
                                    >
                                        {isSubmitting ? (
                                            <span className="loading loading-spinner loading-sm" />
                                        ) : null}
                                        로그인
                                    </button>
                                </div>
                            </form>
                        </div>
                        <button
                            aria-label="모달 배경 닫기"
                            onClick={() => setIsLoginOpen(false)}
                            type="button"
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
