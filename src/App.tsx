import { type ReactNode } from "react";
import { Link } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";

interface AppProps {
    children?: ReactNode;
}

export default function App({ children }: AppProps) {
    return (
        <div className="min-h-screen bg-base-200 text-base-content">
            <header className="border-b border-base-300 bg-base-100">
                <div className="navbar">
                    <div className="navbar-start">
                        <Link className="text-xl font-bold" href="/dashboard">
                            메일렌즈
                        </Link>
                        <span className="ml-4 text-sm text-base-content/60">
                            메일 홍보 검토함
                        </span>
                    </div>
                    <div className="navbar-end">
                        <ThemeToggle />
                    </div>
                </div>
            </header>
            <div className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
                <aside className="border-b border-base-300 bg-base-200 p-3 lg:border-b-0 lg:border-r">
                    <Link
                        className="btn btn-primary btn-sm w-full justify-start"
                        href="/compose"
                    >
                        메일 쓰기
                    </Link>
                    <nav className="mt-5">
                        <ul className="menu w-full gap-1 p-0 text-sm">
                            <li>
                                <Link
                                    className="flex items-center gap-3"
                                    href="/dashboard"
                                >
                                    대시보드
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="flex items-center gap-3"
                                    href="/inbox"
                                >
                                    받은메일함
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="flex items-center gap-3"
                                    href="/contacts"
                                >
                                    연락처 관리
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </aside>
                <main className="bg-base-100">{children}</main>
            </div>
        </div>
    );
}
