// This file is deprecated. Please use the centralized Firebase hooks and instances from '@/firebase'.
// We are exporting the standard instances here to maintain compatibility with existing components during migration.

import { initializeFirebase } from '@/firebase';

const { auth, firestore: db, storage } = initializeFirebase();

export { auth, db, storage };
