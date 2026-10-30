import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "tiktokhd-25f45.firebaseapp.com",
  projectId: "tiktokhd-25f45",
  storageBucket: "tiktokhd-25f45.firebasestorage.app",
  messagingSenderId: "401169393116",
  appId: "1:401169393116:web:3f486ff31550c69afedb19",
  measurementId: "G-JWJZWFTY8Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics only in browser environment
let analytics = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

export { app, analytics };
