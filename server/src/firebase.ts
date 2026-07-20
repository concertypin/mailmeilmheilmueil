import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-mailmeilmheilmueil";

const app = getApps().length ? getApp() : initializeApp({ projectId });

export const db = getFirestore(app);
