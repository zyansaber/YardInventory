// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7YIAnYZkHAq4rh18U2zWLt1vt3F6g8qg",
  authDomain: "yardstock.firebaseapp.com",
  databaseURL: "https://yardstock-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "yardstock",
  storageBucket: "yardstock.firebasestorage.app",
  messagingSenderId: "585682067847",
  appId: "1:585682067847:web:293be397534934be0ef322",
  measurementId: "G-0QCXR0F0RH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

export { database, analytics };
export default app;