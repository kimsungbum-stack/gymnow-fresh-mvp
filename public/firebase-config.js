/*
  Firebase Configuration & Initialization
  Base ID: gymnow-mvp
*/

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getFirestore, collection, onSnapshot, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyDE-zkRDTCI", // Extracted actual key
  authDomain: "gymnow-mvp.firebaseapp.com",
  projectId: "gymnow-mvp",
  storageBucket: "gymnow-mvp.appspot.com",
  messagingSenderId: "795519849439",
  appId: "1:795519849439:web:32f58eab7978fd6503b41e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider, collection, onSnapshot, query, orderBy, signInWithPopup, onAuthStateChanged, signOut };
