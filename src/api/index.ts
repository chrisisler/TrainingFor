import {
  addDoc,
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  FirestoreDataConverter,
  getDoc,
  getDocs,
  query,
  QueryConstraint,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import {
  TrainingLog,
  Movement,
  SavedMovement,
  ProgramLogTemplate,
  ProgramUser,
  Program,
  FirestoreDocument,
} from '../types';
import { db, DbPath } from './firebase';

export * from './firebase';

export const API = init();

function init() {
  const trainingLogsRef = collection(db, DbPath.Logs).withConverter(converter<TrainingLog>());
  const savedMovementsRef = collection(db, DbPath.SavedMovements).withConverter(
    converter<SavedMovement>()
  );
  const movementsRef = collection(db, DbPath.Movements).withConverter(converter<Movement>());
  const programLogTemplatesRef = collection(db, DbPath.ProgramLogTemplates).withConverter(
    converter<ProgramLogTemplate>()
  );
  const programUsersRef = collection(db, DbPath.ProgramUsers).withConverter(
    converter<ProgramUser>()
  );
  const programsRef = collection(db, DbPath.Programs).withConverter(converter<Program>());
  const programMovementsRef = collection(db, DbPath.ProgramMovements).withConverter(
    converter<Movement>()
  );

  const TrainingLogs = createAPI(trainingLogsRef);
  const SavedMovements = createAPI(savedMovementsRef);
  const Movements = createAPI(movementsRef);
  const ProgramLogTemplates = createAPI(programLogTemplatesRef);
  const ProgramUsers = createAPI(programUsersRef);
  const Programs = createAPI(programsRef);
  const ProgramMovements = createAPI(programMovementsRef);

  return {
    TrainingLogs,
    SavedMovements,
    Movements,
    ProgramLogTemplates,
    ProgramUsers,
    Programs,
    ProgramMovements,

    collections: {
      movements: movementsRef,
      savedMovements: savedMovementsRef,
      logs: trainingLogsRef,
      programLogTemplates: programLogTemplatesRef,
      programUsers: programUsersRef,
      programs: programsRef,
      programMovements: programMovementsRef,
    },

    assignAnonymousDataToGoogleUser,
  };
}

function createAPI<T extends FirestoreDocument>(collection: CollectionReference<T>) {
  return {
    async create(entry: T): Promise<T> {
      const newDocumentRef = await addDoc(collection, entry);
      const newEntryData = { ...entry, id: newDocumentRef.id };
      return newEntryData;
    },

    async createMany(entries: T[]) {
      const batch = writeBatch(db);
      entries.forEach(data => {
        batch.set(doc(collection), data);
      });
      await batch.commit();
    },

    async get(id: string): Promise<T> {
      const documentRef = doc(collection.firestore, collection.path, id);
      const document = await getDoc(documentRef);
      const data = { ...document.data(), id: document.id } as T;
      return data;
    },

    async getAll(param: string | QueryConstraint, ...constraints: QueryConstraint[]): Promise<T[]> {
      // Convert given userId to a query constraint OR use the one given.
      const queryConstraint =
        typeof param === 'string' ? where('authorUserId', '==', param) : param;
      const q = query(collection, queryConstraint, ...constraints);
      const { docs } = await getDocs(q);
      return docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
    },

    async update(entry: Partial<T> & { id: string }): Promise<T> {
      const docRef = doc(collection.firestore, collection.path, entry.id);
      // https://github.com/firebase/firebase-js-sdk/issues/5853
      await updateDoc(docRef, { ...entry });
      // Get the latest data and return it
      const document = await getDoc(docRef);
      return { ...document.data(), id: document.id } as T;
    },

    async delete(id: string): Promise<void> {
      const docRef = doc(collection.firestore, collection.path, id);
      await deleteDoc(docRef);
    },
  };
}

function converter<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore: data => data,
    // @ts-ignore
    fromFirestore: doc => Object.assign(doc.data(), { id: doc.id }),
  };
}

/**
 * "Copies" the data from the anonymous user account into the Google user
 * account by reassigning all data from that old user to the new user's ID as
 * the data author.
 */
async function assignAnonymousDataToGoogleUser(oldUserId: string, newUserId: string) {
  const q = where('authorUserId', '==', oldUserId);
  // Get all IDs of the old user's documents
  const snapshots = await Promise.all([
    getDocs(query(API.collections.logs, q)),
    getDocs(query(API.collections.movements, q)),
    getDocs(query(API.collections.savedMovements, q)),
  ]);
  const batch = writeBatch(db);
  snapshots.forEach(({ docs }) => {
    docs.forEach((doc: (typeof docs)[0]) => {
      // Assign the data from the old user to the new user
      batch.update<ReturnType<typeof doc.data>>(doc.ref, { authorUserId: newUserId });
    });
  });
  await batch.commit();
}

// async function fn() {
//   const batch = writeBatch(db);
//   list.forEach(docData => {
//     const newDocRef = doc(collection.firestore, collection.path)
//     batch.set(newDocRef, docData)
//   });
//   await batch.commit();
// }
