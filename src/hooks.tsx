import firebase from 'firebase/app';
import { createContext, FC, useCallback, useContext } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Paths } from './constants';
import { db, DbPath } from './firebase';
import { TrainingLog } from './interfaces';

// Tell TypeScript we're supplying a `firebase.User` here even though we do not
// have an authenticated user yet. This context will not be consumed outside of
// `UserProvider`.
const UserContext = createContext((null as unknown) as firebase.User);

/**
 * Allows descendants of this component to fetch the authenticated user from
 * the `useUser` hook.
 */
export const UserProvider: FC<{
  user: firebase.User;
  children: React.ReactNode;
}> = ({ user, children }) => (
  <UserContext.Provider value={user}>{children}</UserContext.Provider>
);

/**
 * Must be called by a component that is a descendant of `UserProvider`.
 */
export const useUser = (): firebase.User => {
  const user = useContext(UserContext);
  return user;
};

/**
 * Create a new `DbPath.UserLogs` entry and navigate the client to the log
 * editor.
 *
 * Must be used within the `UserProvider` app context (due to accessing the
 * authenticated user).
 */
export const useNewTraining = () => {
  const history = useHistory();
  const user = useUser();

  return useCallback(async () => {
    const newLog: Omit<TrainingLog, 'id'> = {
      title: 'Untitled',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      notes: null,
      authorId: user.uid,
    };
    try {
      const { id } = await db
        .collection(DbPath.Users)
        .doc(user.uid)
        .collection(DbPath.UserLogs)
        .add(newLog);
      history.push(Paths.logEditor(id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, history]);
};
