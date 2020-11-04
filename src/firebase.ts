import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBLnwnJBVUw1SXeK7E1-oL9uCG-ysm1N6w",
  authDomain: "training-for.firebaseapp.com",
  databaseURL: "https://training-for.firebaseio.com",
  projectId: "training-for",
  storageBucket: "training-for.appspot.com",
  messagingSenderId: "860326371875",
  appId: "1:860326371875:web:5c31b733a453ef66134796"

};

// Avoid double-initializing
const app =
  firebase.apps.length === 0
    ? firebase.initializeApp(firebaseConfig)
    : firebase.app();

// Must be in this order
const db = app.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

export enum DbPath { }

export { db, auth, storage };
