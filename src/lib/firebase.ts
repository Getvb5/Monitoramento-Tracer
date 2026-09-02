import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  enableNetwork,
  setLogLevel
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

setLogLevel('error');

const app = initializeApp(firebaseConfig);

const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId || "ai-studio-c51bd8fd-66f7-46cc-a3dd-9c9faf83ced0";

// Initialize Firestore with robust multi-tab IndexedDB cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firestoreDbId);

// Ensure online connection is always active
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('firestore_quota_exceeded');
    enableNetwork(db).catch(() => {});
  } catch (e) {}
}

export const auth = getAuth(app);

// Standard Google provider for app authentication (email, profile)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Dedicated Google provider with additional scopes for Google Docs export
export const googleDocsProvider = new GoogleAuthProvider();
googleDocsProvider.addScope('https://www.googleapis.com/auth/documents');
googleDocsProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleDocsProvider.setCustomParameters({
  prompt: 'select_account'
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// In-memory token cache for Google Docs integration
let cachedAccessToken: string | null = null;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getCachedAccessToken = () => cachedAccessToken;

/**
 * Standard Firebase Google Login (clean, fast, no extra scopes)
 */
export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return result;
};

/**
 * Google Login with Google Docs & Drive scopes for document export
 */
export const requestGoogleDocsAccess = async () => {
  const result = await signInWithPopup(auth, googleDocsProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedAccessToken = credential.accessToken;
  }
  return { result, accessToken: credential?.accessToken };
};

export const logout = () => signOut(auth);

