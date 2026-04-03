// frontend/src/services/firebase.ts
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const MOCK = import.meta.env.VITE_MOCK_MODE === 'true'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Fail fast si la config est incomplète — sauf en mode démo
if (!MOCK) {
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missingKeys.length > 0) {
    throw new Error(
      `Firebase config manquante : ${missingKeys.join(', ')}. Vérifier frontend/.env.local`
    )
  }
}

export const app: FirebaseApp = MOCK
  ? {} as FirebaseApp
  : initializeApp(firebaseConfig)

export const auth: Auth = MOCK ? {} as Auth : getAuth(app)
export const db: Firestore = MOCK ? {} as Firestore : getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
