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
  QueryFieldFilterConstraint,
  updateDoc,
  where,
} from 'firebase/firestore';

// import { TrainingLogsAPI } from './TrainingLogsAPI';
// import { MovementsAPI } from './MovementsAPI';
import { TrainingLog, Movement, SavedMovement } from '../types';
import { db, DbPath } from './firebase';

export * from './firebase';

export const API = init();

function init() {
  const trainingLogsRef = collection(db, DbPath.Logs).withConverter(converter<TrainingLog>());
  const savedMovementsRef = collection(db, DbPath.SavedMovements).withConverter(
    converter<SavedMovement>()
  );
  const movementsRef = collection(db, DbPath.Movements).withConverter(converter<Movement>());

  /** Basic CRUD operations for entities. */
  const TrainingLogs = createAPI<TrainingLog>(trainingLogsRef);
  const SavedMovements = createAPI<SavedMovement>(savedMovementsRef);
  const Movements = createAPI<Movement>(movementsRef);

  /** Fetch all `Movement`s with the given logId. */
  // const getFromLog = async (logId: string) => {
  //   const q = query(movementsRef, where('logId', '==', logId));
  //   return await getDocs(q).then(_ => _.docs.map(_ => _.data()));
  // };

  /** Search all `Movements` with the given name. */
  // const search = async (name: string) => {
  //   const q = query(movementsRef, where('name', '==', name));
  //   return await getDocs(q).then(_ => _.docs.map(_ => _.data()));
  // }

  return {
    TrainingLogs,
    SavedMovements,
    Movements,

    collections: {
      movements: movementsRef,
      savedMovements: savedMovementsRef,
      logs: trainingLogsRef,
    },
  };
}

function createAPI<T extends { id: string }>(collection: CollectionReference<T>) {
  return {
    async create(entry: T): Promise<T> {
      const newDocumentRef = await addDoc(collection, entry);
      const newEntryData = { ...entry, id: newDocumentRef.id };
      return newEntryData;
    },

    async get(id: string): Promise<T> {
      const documentRef = doc(collection.firestore, collection.path, id);
      const document = await getDoc(documentRef);
      const data = { ...document.data(), id: document.id } as T;
      return data;
    },

    /**
     * Pass the userId to simply fetch all resources with the given userId OR
     * pass a queryConstraint to provide a custom `where` clause.
     *
     * @usage API.MyResource.getAll(userId) // Fetch all
     * @usage API.MyResource.getAll(where('customField', '==', customValue)) // Custom fetch
     */
    async getAll(param: string | QueryFieldFilterConstraint): Promise<T[]> {
      // Convert given userId to a query constraint OR use the one given.
      const queryConstraint =
        typeof param === 'string' ? where('authorUserId', '==', param) : param;
      const q = query(collection, queryConstraint);
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
