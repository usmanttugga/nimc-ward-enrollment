import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCz3mnbIq3U525GXVRXHkUozbc9E05jzPI",
  authDomain: "nimc-ward-enrollment.firebaseapp.com",
  projectId: "nimc-ward-enrollment",
  storageBucket: "nimc-ward-enrollment.firebasestorage.app",
  messagingSenderId: "102540666347",
  appId: "1:102540666347:web:344fedb1072149536065ae",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
