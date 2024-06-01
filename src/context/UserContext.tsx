import { User } from 'firebase/auth';
import { FC, ReactNode } from 'react';

import { UserContext } from '../util';

export const UserProvider: FC<{
  user: User;
  children: ReactNode;
}> = ({ user, children }) => {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
};
