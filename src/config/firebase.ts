// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCwGgnb7_exjy9mqIT4USX2h5d7Lr9qfAQ",
  authDomain: "sticker-app-3e4e7.firebaseapp.com",
  projectId: "sticker-app-3e4e7",
  messagingSenderId: "678686688128",
  appId: "1:678686688128:web:ff28d6f7b31b37e8273765",
  measurementId: "G-KX47H6FVMG"
};

// Initialize Firebase (singleton pattern prevents duplicate initializations in HMR)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore Database
export const db = getFirestore(app);

// Initialize Analytics safely with browser/webview compatibility check
export let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics unsupported in headless or restricted webview environments
  });
}
