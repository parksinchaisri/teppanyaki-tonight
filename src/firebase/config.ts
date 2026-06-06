import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Log the resolved config at startup. If projectId is undefined/empty here, the
// build didn't pick up the VITE_FIREBASE_* env vars and the app will silently
// fall back to demo mode (firebaseConfigured = false).
console.log('Firebase config:', { projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID });

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// True when the Firebase env vars are present. The app degrades gracefully to a
// local-only mode (no leaderboard) when they are missing — useful for previewing.
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
