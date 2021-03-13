// eslint-disable-next-line simple-import-sort/imports
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/storage';

import {
  Activity,
  TrainingLog,
  User,
  Comment,
  TrainingTemplate,
} from './interfaces';

const firebaseConfig = {
  apiKey: 'AIzaSyBLnwnJBVUw1SXeK7E1-oL9uCG-ysm1N6w',
  authDomain: 'training-for.firebaseapp.com',
  databaseURL: 'https://training-for.firebaseio.com',
  projectId: 'training-for',
  storageBucket: 'training-for.appspot.com',
  messagingSenderId: '860326371875',
  appId: '1:860326371875:web:5c31b733a453ef66134796',
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

export enum DbPath {
  Users = 'users',
  UserLogs = 'logs',
  UserTemplates = 'templates',
  // TODO Delete this and use `export const db = { activities: db.collection('activities') }`
  UserTemplateActivities = 'activities',
  UserLogActivities = 'activities',
  UserLogActivityComments = 'comments',
}

export { db, auth, storage };

const trainingLogConverter: firebase.firestore.FirestoreDataConverter<TrainingLog> = {
  toFirestore: (log: TrainingLog): firebase.firestore.DocumentData => {
    return log;
  },
  fromFirestore: (
    doc: firebase.firestore.QueryDocumentSnapshot<TrainingLog>
  ): TrainingLog => {
    const data = doc.data();
    data.id = doc.id;
    return data;
  },
};

const activityConverter: firebase.firestore.FirestoreDataConverter<Activity> = {
  toFirestore: (activity: Activity): firebase.firestore.DocumentData => {
    return activity;
  },
  fromFirestore: (
    doc: firebase.firestore.QueryDocumentSnapshot<Activity>
  ): Activity => {
    const data = doc.data();
    data.id = doc.id;
    return data;
  },
};

const userConverter: firebase.firestore.FirestoreDataConverter<User> = {
  toFirestore: (user: User): firebase.firestore.DocumentData => {
    return user;
  },
  fromFirestore: (
    doc: firebase.firestore.QueryDocumentSnapshot<User>
  ): User => {
    const data = doc.data();
    data.id = doc.id;
    return data;
  },
};

const commentConverter: firebase.firestore.FirestoreDataConverter<Comment> = {
  toFirestore: (comment: Comment): firebase.firestore.DocumentData => {
    return comment;
  },
  fromFirestore: (
    doc: firebase.firestore.QueryDocumentSnapshot<Comment>
  ): Comment => {
    const data = doc.data();
    data.id = doc.id;
    return data;
  },
};

const trainingTemplateConverter: firebase.firestore.FirestoreDataConverter<TrainingTemplate> = {
  toFirestore: (
    template: TrainingTemplate
  ): firebase.firestore.DocumentData => {
    return template;
  },
  fromFirestore: (
    doc: firebase.firestore.QueryDocumentSnapshot<TrainingTemplate>
  ): TrainingTemplate => {
    const data = doc.data();
    data.id = doc.id;
    return data;
  },
};

export const DbConverter = {
  TrainingLog: trainingLogConverter,
  TrainingTemplate: trainingTemplateConverter,
  Activity: activityConverter,
  User: userConverter,
  Comment: commentConverter,
};
