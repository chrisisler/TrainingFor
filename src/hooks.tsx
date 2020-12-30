import firebase from 'firebase/app';
import { createContext, FC, useContext } from 'react';

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
