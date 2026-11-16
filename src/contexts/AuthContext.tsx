import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { upsertUserProfile } from '../lib/firestoreService';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  localMode: boolean;
  enterLocalMode: () => void;
  exitLocalMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  updateUserDisplayName: (name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const LOCAL_MODE_KEY = 'cutmaster_local_mode_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [localMode, setLocalMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setAuthReady(true);
      if (fbUser) {
        setLocalMode(false);
        try {
          localStorage.removeItem(LOCAL_MODE_KEY);
        } catch {
          // Ignore
        }
        if (fbUser.emailVerified) {
          try {
            await upsertUserProfile({
              uid: fbUser.uid,
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Carpenter',
              email: fbUser.email || '',
              photoURL: fbUser.photoURL,
            });
          } catch {
            // Non-blocking profile sync
          }
        }
      }
    });
    return () => unsub();
  }, []);

  const enterLocalMode = () => {
    setLocalMode(true);
    try {
      localStorage.setItem(LOCAL_MODE_KEY, 'true');
    } catch {
      // Ignore
    }
  };

  const exitLocalMode = () => {
    setLocalMode(false);
    try {
      localStorage.removeItem(LOCAL_MODE_KEY);
    } catch {
      // Ignore
    }
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    if (cred.user) {
      await upsertUserProfile({
        uid: cred.user.uid,
        displayName: cred.user.displayName || 'Workshop Member',
        email: cred.user.email || '',
        photoURL: cred.user.photoURL,
      });
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (cred.user) {
      await updateProfile(cred.user, { displayName: name.trim() });
      await sendEmailVerification(cred.user);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshUser = async () => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    const refreshed = auth.currentUser;
    setUser(refreshed ? ({ ...refreshed } as User) : null);
    if (refreshed?.emailVerified) {
      await upsertUserProfile({
        uid: refreshed.uid,
        displayName: refreshed.displayName || refreshed.email?.split('@')[0] || 'Carpenter',
        email: refreshed.email || '',
        photoURL: refreshed.photoURL,
      });
      return true;
    }
    return false;
  };

  const updateUserDisplayName = async (name: string) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: name.trim() });
    if (auth.currentUser.emailVerified) {
      await upsertUserProfile({
        uid: auth.currentUser.uid,
        displayName: name.trim(),
        email: auth.currentUser.email || '',
        photoURL: auth.currentUser.photoURL,
      });
    }
    setUser({ ...auth.currentUser } as User);
  };

  const logout = async () => {
    exitLocalMode();
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        localMode,
        enterLocalMode,
        exitLocalMode,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        resendVerification,
        refreshUser,
        updateUserDisplayName,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
