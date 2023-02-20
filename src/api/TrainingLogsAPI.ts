export {};
// import {
//   where,
//   getDoc,
//   getDocs,
//   query,
//   updateDoc,
//   deleteDoc,
//   addDoc,
//   doc,
// } from 'firebase/firestore';

// import { TrainingLog } from '../types';
// import { logCollection } from './firebase';

// export const TrainingLogsAPI = {
//   async create(entry: TrainingLog): Promise<TrainingLog> {
//     const collection = logCollection;
//     const newDocumentRef = await addDoc(collection, entry);
//     const newEntryData = { ...entry, id: newDocumentRef.id };
//     return newEntryData;
//   },

//   async get(id: string): Promise<TrainingLog> {
//     const collection = logCollection;
//     const documentRef = doc(collection.firestore, collection.path, id);
//     const document = await getDoc(documentRef);
//     const data = { ...document.data(), id: document.id } as TrainingLog;
//     return data;
//   },

//   async getAll(userId: string): Promise<TrainingLog[]> {
//     const collection = logCollection;
//     const q = query(collection, where('authorUserId', '==', userId));
//     const { docs } = await getDocs(q);
//     return docs.map(doc => ({ ...doc.data(), id: doc.id } as TrainingLog));
//   },

//   async update(entry: TrainingLog): Promise<TrainingLog> {
//     const collection = logCollection;
//     const docRef = doc(collection.firestore, collection.path, entry.id);
//     // https://github.com/firebase/firebase-js-sdk/issues/5853
//     await updateDoc(docRef, { ...entry });
//     // Get the latest data and return it
//     const document = await getDoc(docRef);
//     return { ...document.data(), id: document.id } as TrainingLog;
//   },

//   async delete(id: string): Promise<void> {
//     const collection = logCollection;
//     const docRef = doc(collection.firestore, collection.path, id);
//     await deleteDoc(docRef);
//   },
// };
