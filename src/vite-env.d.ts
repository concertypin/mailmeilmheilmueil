/// <reference types="vite/client" />
/*
interface Window {
    __SPA_ROUTE__?: string | undefined;
}*/

interface ImportMetaEnv {
    readonly VITEST_MODE: "browser" | "node";
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface ViteTypeOptions {
    strictImportMetaEnv: unknown;
}
