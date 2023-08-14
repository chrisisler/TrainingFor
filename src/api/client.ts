import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  CollectionReference,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  QueryConstraint,
  updateDoc,
  where,
  writeBatch,
  WriteBatch,
} from 'firebase/firestore';

import { useUser } from '../context';
import { FirestoreDocument } from '../types';
import { db, DbPath } from './firebase';

/**
 * @example
 *
 * // create, update, and delete
 * const LogsAPI = useAPI(API.TrainingLogs, DbPath.Logs)
 *
 * // read
 * const logs = DataState.from(useQuery(({
 *   queryKey: [DbPath.Logs, user.uid],
 *   queryFn: () => API.TrainingLogs.getAll()
 * })))
 */
export function useAPI<T extends { id: string }>(
  apiClient: ReturnType<typeof createAPI<T>>,
  dbPath: DbPath
) {
  const queryClient = useQueryClient();
  const user = useUser();

  const { mutateAsync: create } = useMutation({
    mutationFn: apiClient.create,
    onSuccess: () => queryClient.invalidateQueries([dbPath, user.uid]),
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: apiClient.update,
    onSuccess: () => queryClient.invalidateQueries([dbPath, user.uid]),
  });

  const { mutateAsync: _delete } = useMutation({
    mutationFn: apiClient.delete,
    onSuccess: () => queryClient.invalidateQueries([dbPath, user.uid]),
  });

  // const q = DataState.from(useQuery({
  //   queryKey: [dbPath, user.uid],
  //   queryFn: () => apiClient.getAll(),
  // }))

  return {
    create,
    update,
    delete: _delete,
  };
}

export function createAPI<T extends FirestoreDocument>(collection: CollectionReference<T>) {
  return {
    async create(entry: Omit<T, 'id'>): Promise<T> {
      const newDocumentRef = await addDoc(collection, entry);
      return { ...entry, id: newDocumentRef.id } as T;
    },

    async get(id: string): Promise<T> {
      const documentRef = doc(collection.firestore, collection.path, id);
      const document = await getDoc(documentRef);
      if (document.exists()) {
        return { ...document.data(), id: document.id } as T;
      }
      throw Error(`Document with id ${id} does not exist`);
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

    async createMany(entries: T[]): Promise<void> {
      const batch = writeBatch(db);
      entries.forEach(data => {
        batch.set(doc(collection), data);
      });
      await batch.commit();
    },

    async deleteMany(...constraints: QueryConstraint[]): Promise<void> {
      const batch = writeBatch(db);
      const q = query(collection, ...constraints);
      const { docs } = await getDocs(q);
      docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    },

    async batch(op: (batch: WriteBatch) => Promise<void>): Promise<void> {
      const batch = writeBatch(db);
      op(batch);
      await batch.commit();
    },
  };
}
