import { User } from 'firebase/auth';
import { useState, useEffect, useCallback } from 'react';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/with-selector';

import { DataState } from '../util';
import { auth } from './firebase';

interface Store {
  authState: DataState<User>;
  setUser(user: User): void;
}

const listeners = new Set();
const subscribe = (listener: (store: Store) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useAuthStore<T>(selector: (store: Store) => T) {
  const [userState, setUserState] = useState<DataState<User>>(DataState.Loading);

  useEffect(() => {
    return auth.onAuthStateChanged(
      user => {
        if (user) setUserState(user.toJSON() as User);
        else setUserState(DataState.Empty);
      },
      err => {
        setUserState(DataState.error(err.message));
      }
    );
  }, []);

  // It's important for this value to adhere to immutability principles because
  // it's likely to be used by effects and APIs
  const getSnapshot = useCallback(
    () => ({
      authState: userState,
      setUser: (user: User) => setUserState(user),
    }),
    [userState]
  );

  return useSyncExternalStoreWithSelector(subscribe, getSnapshot, null, selector);
}
