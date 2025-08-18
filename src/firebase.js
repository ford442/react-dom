// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC1egJ5RR7q4SUcvDPyOaH2H6kzp2sHHtU",
  authDomain: "compiled-results.firebaseapp.com",
  projectId: "compiled-results",
  storageBucket: "compiled-results.firebasestorage.app",
  messagingSenderId: "226121150167",
  appId: "1:226121150167:web:d759ce0fb2c6af4eb8ca92",
  measurementId: "G-HJ03STZS81"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

export { db };
