import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, disableNetwork } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// If quota is already marked as exceeded, proactively disable the network
// to prevent Firestore SDK background retries and console/network noise.
if (typeof window !== 'undefined' && localStorage.getItem('firestore_quota_exceeded') === 'true') {
  console.log("[Firebase] Local storage quota limit flag is active. Disabling network on startup.");
  disableNetwork(db).catch((e) => {
    console.error("[Firebase] Error disabling network on startup:", e);
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('firestore-quota-exceeded', () => {
    console.log("[Firebase] Runtime quota limit exceeded. Disabling Firestore network to prevent retries.");
    disableNetwork(db).catch((e) => {
      console.error("[Firebase] Error disabling network on quota exceeded:", e);
    });
  });
}

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Test Connection
async function testConnection() {
  if (typeof window !== 'undefined' && localStorage.getItem('firestore_quota_exceeded') === 'true') {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

