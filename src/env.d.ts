/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_MAIL_MODE: "attach" | "detach";
}
interface Window {
    __SPA_ROUTE__?: string;
}
