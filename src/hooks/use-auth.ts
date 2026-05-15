
"use client";

import { useEffect, useState } from 'react';
import { useAuth as useFirebaseAuth, useFirestore, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export interface UserProfile {
  uid: string;
  companyName: string;
  ownerName: string;
  email: string;
  role: 'transporter' | 'admin';
  mobile: string;
  officePhone: string;
  gstNo: string;
  address: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  profileCompleted: boolean;
  createdAt: any;
}

export function useAuth() {
  const auth = useFirebaseAuth();
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (userLoading) return;

    if (user && db) {
      const profileRef = doc(db, 'users', user.uid);
      const unsubscribeProfile = onSnapshot(profileRef, (snapshot) => {
        if (snapshot.exists()) {
          setProfile({ ...snapshot.data(), uid: snapshot.id } as UserProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });

      return () => unsubscribeProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user, userLoading, db]);

  const logout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  return { user, profile, loading: loading || userLoading, logout, auth, db };
}
