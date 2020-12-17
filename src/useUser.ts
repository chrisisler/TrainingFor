import { useState, useEffect } from 'react';
import firebase from 'firebase';

import { auth } from './firebase';

export const useUser = (): [
  firebase.User | null,
  React.Dispatch<React.SetStateAction<firebase.User | null>>
] => {
  const [user, setUser] = useState<firebase.User | null>(null);

  useEffect(() => {
    return auth.onAuthStateChanged(user => {
      setUser(user);
    });
  }, []);

  return [user, setUser];
};
