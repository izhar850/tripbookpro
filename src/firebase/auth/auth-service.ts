'use client';

import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  type User,
  type Auth
} from 'firebase/auth';

/**
 * Signs in a user with email and password.
 */
export const login = (auth: Auth, email: string, pass: string) => {
  return signInWithEmailAndPassword(auth, email, pass);
};

/**
 * Creates a new user with email and password.
 */
export const signup = (auth: Auth, email: string, pass: string) => {
  return createUserWithEmailAndPassword(auth, email, pass);
};

/**
 * Logs out the current user.
 */
export const logout = (auth: Auth) => {
  return signOut(auth);
};

/**
 * Listens for changes in the authentication state.
 */
export const subscribeToAuthChanges = (auth: Auth, callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
