import { initializeApp, getApps } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import type { Tournament } from "./tournament";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

const app = firebaseEnabled ? getApps()[0] ?? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

export async function saveTournament(tournament: Tournament) {
  if (!db) return;
  await setDoc(doc(db, "tournaments", tournament.id), tournament);
}

export async function loadTournament(id: string) {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "tournaments", id));
  return snapshot.exists() ? (snapshot.data() as Tournament) : null;
}
