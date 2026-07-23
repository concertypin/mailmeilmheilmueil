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
                        <Link className="text-xl font-bold" href="/inbox">
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
            <main className="min-h-[calc(100vh-4.5rem)]">{children}</main>
        </div>
    );
}
