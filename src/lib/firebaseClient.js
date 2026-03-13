import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyC_h0hxSm60o3Jdnrohuylq5hP9MWSSO-s',
  authDomain: 'bigbackend-60150.firebaseapp.com',
  databaseURL: 'https://bigbackend-60150-default-rtdb.firebaseio.com',
  projectId: 'bigbackend-60150',
  storageBucket: 'bigbackend-60150.firebasestorage.app',
  messagingSenderId: '913855064581',
  appId: '1:913855064581:web:0140ae327167a246858a6c',
  measurementId: 'G-Q2D0DXRS6Y',
};

const app = initializeApp(firebaseConfig);

export const firestore = getFirestore(app);
export const storage = getStorage(app);
