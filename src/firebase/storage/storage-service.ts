'use client';

import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  type StorageReference
} from 'firebase/storage';
import { 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { storage, db } from '@/firebase';

export interface TripFile {
  id: string;
  companyId: string;
  userId: string;
  tripId: string;
  lrNo?: string;
  fileType: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  uploadedAt: any;
  uploadedBy: string;
  notes?: string;
}

/**
 * Uploads a file to Firebase Storage and creates a record in Firestore.
 */
export const uploadTripFile = async ({
  companyId,
  userId,
  tripId,
  lrNo,
  file,
  fileType,
  notes
}: {
  companyId: string;
  userId: string;
  tripId: string;
  lrNo?: string;
  file: File;
  fileType: string;
  notes?: string;
}, onProgress?: (progress: number) => void) => {
  // 1. Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File size exceeds 5MB limit.');
  }

  // 2. Check file limit (10 files per trip)
  const existingFiles = await fetchTripFiles(companyId, tripId);
  if (existingFiles.length >= 10) {
    throw new Error('Maximum limit of 10 files per trip reached.');
  }

  // 3. Generate filename: {fileType}_{timestamp}_{originalFileName}
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  const timestamp = `${dateStr}_${timeStr}`;
  const sanitizedName = file.name.replace(/\s+/g, '_');
  const fileName = `${fileType}_${timestamp}_${sanitizedName}`;
  const storagePath = `trip-files/${companyId}/${tripId}/${fileName}`;
  
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise<TripFile>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        try {
          const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          // 4. Create Firestore record
          const fileDocRef = doc(collection(db, 'tripFiles'));
          const fileData = {
            companyId,
            userId,
            tripId,
            lrNo: lrNo || '',
            fileType,
            fileName,
            fileUrl,
            storagePath,
            uploadedAt: serverTimestamp(),
            uploadedBy: userId,
            notes: notes || ''
          };
          
          await setDoc(fileDocRef, fileData);

          // 5. Update Trip document if POD
          if (fileType === 'POD') {
            const tripRef = doc(db, 'trips', tripId);
            await runTransaction(db, async (transaction) => {
              transaction.update(tripRef, {
                hasPOD: true,
                podUploadedAt: serverTimestamp()
              });
            });
          }

          resolve({ id: fileDocRef.id, ...fileData, uploadedAt: new Date() });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

/**
 * Fetches all files for a specific trip.
 */
export const fetchTripFiles = async (companyId: string, tripId: string): Promise<TripFile[]> => {
  const q = query(
    collection(db, 'tripFiles'),
    where('companyId', '==', companyId),
    where('tripId', '==', tripId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as TripFile));
};

/**
 * Deletes a file from Storage and Firestore.
 */
export const deleteTripFile = async (file: TripFile) => {
  try {
    // 1. Delete from Storage
    const storageRef = ref(storage, file.storagePath);
    await deleteObject(storageRef);
    
    // 2. Delete from Firestore
    await deleteDoc(doc(db, 'tripFiles', file.id));

    // 3. If it was the last POD, update trip status? (Optional, skipping for now as per "do not break")
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};
