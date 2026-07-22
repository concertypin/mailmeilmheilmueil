import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "mail-lens-theme";
type Theme = "light" | "dark";

export default function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>(() =>
        localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"
    );

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme]);

    return (
        <button
            aria-label={
                theme === "dark" ? "라이트 모드 전환" : "다크 모드 전환"
            }
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "라이트 모드" : "다크 모드"}
            type="button"
        >
            {theme === "dark" ? (
                <SunIcon aria-hidden="true" size={18} weight="fill" />
            ) : (
                <MoonIcon aria-hidden="true" size={18} weight="fill" />
            )}
        </button>
    );
}
