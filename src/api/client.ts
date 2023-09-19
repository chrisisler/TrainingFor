import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CollectionReference,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  QueryConstraint,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { FirestoreDocument } from '../types';
import { db } from './firebase';

export function useAPI<T extends { id: string }>(
  apiClient: ReturnType<typeof createAPI<T>>,
  queryKey: QueryKey
) {
  const queryClient = useQueryClient();
  // Exact=false means create/update/delete operations with
  // queryKey=['Movements'] invalidates *ANY* query with 'Movements' in its queryKey
  const opts = { queryKey, exact: false };

  const { mutateAsync: create } = useMutation({
    mutationFn: apiClient.create,
    onSuccess: () => queryClient.invalidateQueries(opts),
  });

  const { mutateAsync: createMany } = useMutation({
    mutationFn: apiClient.createMany,
    onSuccess: () => queryClient.invalidateQueries(opts),
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: apiClient.update,
    onSuccess: () => queryClient.invalidateQueries(opts),
  });

  const { mutateAsync: _delete } = useMutation({
    mutationFn: apiClient.delete,
    onSuccess: () => queryClient.invalidateQueries(opts),
  });

  const { mutateAsync: deleteMany } = useMutation({
    mutationFn: apiClient.deleteMany,
    onSuccess: () => queryClient.invalidateQueries(opts),
  });

  return {
    queryKey,
    create,
    createMany,
    update,
    delete: _delete,
    deleteMany,
  };
}

export function createAPI<T extends FirestoreDocument>(collection: CollectionReference<T>) {
  return {
    async create(entry: Omit<T, 'id'>): Promise<T> {
      const newDoc = doc(collection);
      const fields = Object.assign(entry, { id: newDoc.id }) as T;
      await setDoc(newDoc, fields);
      return fields;
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
  };
}
