import { useState, type SubmitEventHandler } from "react";
import { Link } from "react-router-dom";

const PLACEHOLDER_MESSAGE = "IMAP 연결 기능을 준비 중입니다. 현재는 테스트 메일함을 사용해 주세요.";

export default function Login() {
    const [userId, setUserId] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        setMessage(PLACEHOLDER_MESSAGE);
        setPassword("");
    }

    return (
        <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center py-8">
            <section className="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
                <div className="card-body gap-6">
                    <div>
                        <p className="text-sm font-semibold text-primary">KANGNAM UNIVERSITY MAIL</p>
                        <h1 className="mt-2 text-3xl font-bold">강남대학교 메일 로그인</h1>
                        <p className="mt-3 text-sm leading-6 text-base-content/70">
                            강남대 메일함을 연결하면 공유 메일을 확인할 수 있습니다. 연결 대상은
                            <strong className="mx-1 text-base-content">mail.kangnam.ac.kr:993 (IMAP SSL/TLS)</strong>
                            이며, 비밀번호는 저장하지 않습니다.
                        </p>
                    </div>

                    {message && (
                        <div role="alert" className="alert alert-info">
                            <span>{message}</span>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <label className="form-control w-full">
                            <span className="label-text mb-2 font-medium">강남대 ID</span>
                            <input
                                aria-label="강남대 ID"
                                className="input input-bordered w-full"
                                placeholder="강남대 포털 아이디"
                                type="text"
                                value={userId}
                                onChange={(event) => setUserId(event.currentTarget.value)}
                                autoComplete="username"
                            />
                        </label>
                        <label className="form-control w-full">
                            <span className="label-text mb-2 font-medium">비밀번호</span>
                            <input
                                aria-label="비밀번호"
                                className="input input-bordered w-full"
                                placeholder="강남대 포털 비밀번호"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.currentTarget.value)}
                                autoComplete="current-password"
                            />
                        </label>
                        <button className="btn btn-primary w-full" type="submit">
                            메일함 연결
                        </button>
                    </form>

                    <Link className="btn btn-ghost" to="/">
                        테스트 메일함으로 계속
                    </Link>
                </div>
            </section>
        </div>
    );
}
