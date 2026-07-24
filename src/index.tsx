/* @refresh reload */
import "@/index.css";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";
import { Route, Switch } from "wouter";
import App from "@/App";
import { MailDataProvider } from "@/lib/mail-data";
import { AddressBookProvider } from "@/lib/contact-book-data";
import Compose from "@/pages/Compose";
import Contacts from "@/pages/Contacts";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import MailReview from "@/pages/MailReview";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error("Root element not found.");
}

createRoot(root!).render(
    <>
        <MailDataProvider>
            <AddressBookProvider>
                <Switch>
                    <Route path="/" component={Landing} />
                    <Route path="/dashboard">
                        <App>
                            <Dashboard />
                        </App>
                    </Route>
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
                    <Route path="/compose">
                        <App>
                            <Compose />
                        </App>
                    </Route>
                    <Route path="/mails/:mailId">
                        <App>
                            <MailReview />
                        </App>
                    </Route>
                    <Route component={Landing} />
                </Switch>
            </AddressBookProvider>
        </MailDataProvider>
        {import.meta.env.DEV ? <Agentation /> : null}
    </>
);
