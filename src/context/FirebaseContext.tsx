import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser,
  signInAnonymously
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserStats } from '../types';

interface FirebaseContextType {
  user: FirebaseUser | null;
  userStats: UserStats | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  addWin: () => Promise<void>;
  addLoss: () => Promise<void>;
  addDraw: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Monitor Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Logged in: Sync stats document from Firestore
        await syncUserStats(firebaseUser);
      } else {
        setUserStats(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Fetch or generate user stats on Firestore
  const syncUserStats = async (fUser: FirebaseUser) => {
    const userDocRef = doc(db, 'users', fUser.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setUserStats(docSnap.data() as UserStats);
      } else {
        // First time sign-up: Bootstrap stats
        const initialStats: UserStats = {
          uid: fUser.uid,
          email: fUser.email || `${fUser.uid.substring(0, 8)}@guest.chess`,
          displayName: fUser.displayName || 'لاعب شطرنج مجهول',
          photoURL: fUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fUser.uid}`,
          wins: 0,
          losses: 0,
          draws: 0,
          points: 1000, // standard baseline rating
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, {
          ...initialStats,
          createdAt: serverTimestamp()
        });
        setUserStats(initialStats);
      }
    } catch (err) {
      console.warn('Syncing stats failed - operating in local simulated mode:', err);
      // Fallback local stats
      setUserStats({
        uid: fUser.uid,
        email: fUser.email || 'guest@chess.com',
        displayName: fUser.displayName || 'زائر',
        photoURL: fUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fUser.uid}`,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 1000,
        createdAt: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  // Google Login popup
  const signInWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      setLoading(false);
      throw err;
    }
  };

  // Sign In as Guest/Anonymous
  const signInAsGuest = async (customName: string) => {
    setLoading(true);
    try {
      const res = await signInAnonymously(auth);
      if (res.user) {
        const userDocRef = doc(db, 'users', res.user.uid);
        const initialStats: UserStats = {
          uid: res.user.uid,
          email: `${res.user.uid.substring(0, 8)}@chess3d.guest`,
          displayName: customName || `زائر ${res.user.uid.substring(0, 4)}`,
          photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${res.user.uid}`,
          wins: 0,
          losses: 0,
          draws: 0,
          points: 1000,
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(userDocRef, {
            ...initialStats,
            createdAt: serverTimestamp()
          });
        } catch (dbErr) {
          console.warn('Saving guest profile in firestore denied, operating in local state:', dbErr);
        }
        setUserStats(initialStats);
      }
    } catch (err: any) {
      console.error('Anonymous sign-in failed, falling back to local guest:', err);
      
      const fallbackUid = 'local_guest_' + Math.random().toString(36).substring(2, 11);
      const initialStats: UserStats = {
        uid: fallbackUid,
        email: `${fallbackUid.substring(0, 18)}@chess3d.local`,
        displayName: customName || `زائر محلي ${fallbackUid.substring(12, 16)}`,
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${fallbackUid}`,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 1000,
        createdAt: new Date().toISOString()
      };
      
      const mockUser = {
        uid: fallbackUid,
        displayName: initialStats.displayName,
        email: initialStats.email,
        emailVerified: false,
        isAnonymous: true,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => '',
        getIdTokenResult: async () => ({}) as any,
        reload: async () => {},
        toJSON: () => ({})
      } as unknown as FirebaseUser;
      
      setUser(mockUser);
      setUserStats(initialStats);
      setLoading(false);
      
      // Throw custom error so App.tsx can show a friendly warning details
      throw new Error(`PROVIDER_DISABLED_FALLBACK: ${err.message || err}`);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserStats(null);
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Incremental Statistics functions wrapping Firestore operations securely
  const addWin = async () => {
    if (!user || !userStats) return;
    const currentPoints = userStats.points;
    const currentWins = userStats.wins;

    const updated = {
      ...userStats,
      wins: currentWins + 1,
      points: currentPoints + 25
    };
    setUserStats(updated);

    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        wins: currentWins + 1,
        points: currentPoints + 25
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const addLoss = async () => {
    if (!user || !userStats) return;
    const currentPoints = userStats.points;
    const currentLosses = userStats.losses;

    const updated = {
      ...userStats,
      losses: currentLosses + 1,
      points: Math.max(100, currentPoints - 15)
    };
    setUserStats(updated);

    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        losses: currentLosses + 1,
        points: Math.max(100, currentPoints - 15)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const addDraw = async () => {
    if (!user || !userStats) return;
    const currentPoints = userStats.points;
    const currentDraws = userStats.draws;

    const updated = {
      ...userStats,
      draws: currentDraws + 1,
      points: currentPoints + 5
    };
    setUserStats(updated);

    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        draws: currentDraws + 1,
        points: currentPoints + 5
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <FirebaseContext.Provider value={{
      user,
      userStats,
      loading,
      signInWithGoogle,
      signInAsGuest,
      logout,
      addWin,
      addLoss,
      addDraw
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
