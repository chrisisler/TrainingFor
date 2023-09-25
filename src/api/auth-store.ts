import { User } from 'firebase/auth';
import { useState, useEffect } from 'react';
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

  const setUser = (user: User) => {
    setUserState(user);
  };

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

  const store = {
    authState: userState,
    setUser,
  };

  return useSyncExternalStoreWithSelector(subscribe, () => store, null, selector);
}
