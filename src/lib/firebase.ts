import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
export const storage = getStorage(app);

export const uploadAudio = async (path: string, blob: Blob): Promise<string> => {
  try {
    const audioRef = ref(storage, path);
    const uploadPromise = uploadBytes(audioRef, blob).then(() => getDownloadURL(audioRef));
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error("Storage upload timed out")), 2000)
    );
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    console.warn("Firebase Storage upload failed or timed out. Falling back to inline base64 audio.", err);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to convert audio to base64"));
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
};

export const signIn = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

// Validate connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('unavailable')) {
      // Quietly ignore transient initialization connection issues
      return;
    }
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
