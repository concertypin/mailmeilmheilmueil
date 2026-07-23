/* @refresh reload */
import "@/index.css";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { Route, Switch } from "wouter";
import App from "@/App";
import { MailDataProvider } from "@/lib/mail-data";
import Home from "@/pages/Home";
import Contacts from "@/pages/Contacts";
import Landing from "@/pages/Landing";
import MailReview from "@/pages/MailReview";
const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error("Root element not found.");
}

createRoot(root!).render(
    <>
        <MailDataProvider>
            <Switch>
                <Route path="/" component={Landing} />
                <Route path="/inbox">
                    <App>
                        <Home />
                    </App>
                </Route>
                <Route path="/contacts">
                    <App>
                        <Contacts />
                    </App>
                </Route>
                <Route path="/mails/:mailId">
                    <App>
                        <MailReview />
                    </App>
                </Route>
                <Route component={Landing} />
            </Switch>
        </MailDataProvider>
        {import.meta.env.DEV ? <Agentation /> : null}
    </>
);
