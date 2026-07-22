import { type ReactNode } from "react";

interface AppProps {
    children?: ReactNode;
}

export default function App({ children }: AppProps) {
    return (
        <div className="min-h-screen bg-base-200 text-base-content">
            <header className="border-b border-base-300 bg-base-100">
                <div className="navbar mx-auto max-w-7xl px-4 sm:px-6">
                    <a className="text-xl font-bold" href="/">
                        메일렌즈
                    </a>
                    <span className="ml-4 text-sm text-base-content/60">
                        메일 홍보 검토함
                    </span>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                {children}
            </main>
        </div>
    );
}
