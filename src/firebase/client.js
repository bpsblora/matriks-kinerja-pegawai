// Modul SDK Web Firebase DEV untuk bundler modern seperti Vite.
// Belum digunakan oleh halaman publik dan belum menyambungkan prototipe v2.6.
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
for (const key of requiredKeys) {
  if (!firebaseConfig[key]) {
    throw new Error(`Konfigurasi Firebase belum lengkap: ${key}`);
  }
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTION_REGION || "us-central1");

// Username/password diperiksa oleh backend Cloud Functions (saat diaktifkan).
// Firestore tetap ditutup oleh firestore.rules (deny-all).
