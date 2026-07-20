import { collection, connectFirestoreEmulator, getFirestore, orderBy, query, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import { MailItemSchema, type MailItem } from "./mail-schema";

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-mailmeilmheilmueil";
const app = getApps()[0] ?? initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app-id",
});

const firestore = getFirestore(app);
let emulatorConnected = false;
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true" && !emulatorConnected) {
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    emulatorConnected = true;
}

export function subscribeToMailItems(onItems: (items: MailItem[]) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
        query(collection(firestore, "mailItems"), orderBy("receivedAt", "desc")),
        (snapshot) => onItems(snapshot.docs.map((doc) => MailItemSchema.parse({ id: doc.id, ...doc.data() }))),
        (error) => onError(error)
    );
}

export function subscribeToMailItem(id: string, onItem: (item: MailItem | null) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
        query(collection(firestore, "mailItems"), orderBy("receivedAt", "desc")),
        (snapshot) => {
            const doc = snapshot.docs.find((candidate) => candidate.id === id);
            onItem(doc ? MailItemSchema.parse({ id: doc.id, ...doc.data() }) : null);
        },
        (error) => onError(error)
    );
}
