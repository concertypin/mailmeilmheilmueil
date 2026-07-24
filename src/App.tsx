import { type ReactNode } from "react";
import { Link } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";

interface AppProps {
    children?: ReactNode;
}

export default function App({ children }: AppProps) {
    return (
        <div className="min-h-screen bg-base-200 text-base-content">
            <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100">
                <div className="navbar">
                    <div className="navbar-start">
                        <Link className="text-xl font-bold" href="/dashboard">
                            메일렌즈
                        </Link>
                        <span className="ml-4 hidden text-sm text-base-content/60 sm:inline">
                            메일 홍보 검토함
                        </span>
                    </div>
                    <div className="navbar-center hidden lg:flex">
                        <ul className="menu menu-horizontal gap-1 px-1 text-sm">
                            <li>
                                <Link href="/dashboard">대시보드</Link>
                            </li>
                            <li>
                                <Link href="/inbox">메일함</Link>
                            </li>
                        </ul>
                    </div>
                    <div className="navbar-end">
                        <ThemeToggle />
                    </div>
                </div>
            </header>
            <main className="min-h-[calc(100vh-4.5rem)]">{children}</main>
        </div>
    );
}
