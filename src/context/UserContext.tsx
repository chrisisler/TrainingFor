import { User } from 'firebase/auth';
import { createContext, FC, ReactNode, useContext } from 'react';

const UserContext = createContext(null as unknown as User);

export const UserProvider: FC<{
  user: User;
  children: ReactNode;
}> = ({ user, children }) => <UserContext.Provider value={user}>{children}</UserContext.Provider>;

export const useUser = (): User => useContext(UserContext);
