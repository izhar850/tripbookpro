"use client";

import { useEffect, useState } from 'react';
import { useAuth as useFirebaseAuth, useFirestore, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export interface UserProfile {
  uid: string;
  companyId: string;
  companyName: string;
  ownerName: string;
  email: string;
  role: 'transporter' | 'admin' | 'super_admin';
  accountStatus?: 'pending' | 'active' | 'suspended';
  plan?: 'trial' | 'monthly' | 'three_months' | 'six_months' | 'yearly';
  planName?: string;
  planStartDate?: any;
  planExpiryDate?: any;
  paymentStatus?: 'pending' | 'paid' | 'unpaid' | 'overdue';
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
      const unsubscribeProfile = onSnapshot(
        profileRef, 
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProfile({ ...data, uid: snapshot.id, companyId: data?.companyId || snapshot.id } as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        },
        async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: profileRef.path,
            operation: 'get',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          setLoading(false);
        }
      );

      return () => unsubscribeProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user, userLoading, db]);

  const logout = async (redirectTo = '/login') => {
    if (auth) {
      await signOut(auth);
      router.push(redirectTo);
    }
  };

  return { user, profile, loading: loading || userLoading, logout, auth, db };
}
