/* @refresh reload */
import "@/index.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "@/App";
import Home from "@/pages/Home";
import MailReview from "@/pages/MailReview";
const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error("Root element not found.");
}

createRoot(root!).render(
    <BrowserRouter>
        <App>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/mails/:mailId" element={<MailReview />} />
                <Route path="*" element={<Home />} />
            </Routes>
        </App>
    </BrowserRouter>
);
