import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCu3rPNMnvjnCBTaLLqIT868B74lsl6qUo',
  authDomain: 'training-for-2.firebaseapp.com',
  projectId: 'training-for-2',
  storageBucket: 'training-for-2.appspot.com',
  messagingSenderId: '404967486635',
  appId: '1:404967486635:web:23b55be14b5c6f992a33ee',
};

// Avoid double-initializing
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);

export enum DbPath {
  Logs = 'TrainingLogs',
  Movements = 'Movements',
  SavedMovements = 'SavedMovements',
  // Templates = 'Templates',
}

/** Ways of logging in. */
export const Authenticate = {
  withGoogle: async () => {
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider);
    await Promise.resolve();
    return await getRedirectResult(auth);
  },
  anonymously: async () => {
    return await signInAnonymously(auth);
  },
};

