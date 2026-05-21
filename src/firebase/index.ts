'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

export let app: FirebaseApp;
export let db: Firestore;
export let auth: Auth;
export let storage: FirebaseStorage;

/**
 * Initializes Firebase services if they haven't been initialized already.
 */
export function initializeFirebase() {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    app = initializeApp(firebaseConfig);
  }

  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);

  return { app, firestore: db, auth, storage };
}

export * from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';
export { FirebaseClientProvider } from './client-provider';
export * from './auth/auth-service';
