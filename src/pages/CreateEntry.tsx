import React, { FC } from 'react';

import { auth } from '../firebase';

export const CreateEntry: FC = () => {
  auth.signOut();
  return (
    <div>
      <h1>Create Entry</h1>
      {/** Date */}
      {/** Session description */}
      {/** Set create */}
      {/** Set list */}
    </div>
  );
};
