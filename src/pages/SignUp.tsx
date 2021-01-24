import { css } from '@emotion/css';
import { Button, TextField, Typography } from '@material-ui/core';
import firebase from 'firebase/app';
import React, { FC, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Paths } from '../constants';
import { auth, db, DbPath } from '../firebase';
import { User } from '../interfaces';
import { Columns, Pad } from '../style';

export const SignUp: FC = () => {
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const history = useHistory();

  const addUser = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      try {
        const userPromise = auth.createUserWithEmailAndPassword(
          email,
          password
        );
        setPassword('');
        const userCredential = await userPromise;
        if (!userCredential.user) throw Error('Unreachable');
        await userCredential.user.updateProfile({ displayName });
        const newUser: Omit<User, 'id'> = {
          displayName,
          creationTime: firebase.firestore.FieldValue.serverTimestamp(),
          followers: [],
          following: [],
        };
        // Insert the user data under the id = uid
        db.collection(DbPath.Users).doc(userCredential.user.uid).set(newUser);
      } catch (error) {
        toast.error(error.message);
      }
    },
    [displayName, email, password]
  );

  return (
    <div
      className={css`
        height: 100vh;
        width: 100%;
        display: grid;
        place-items: center;
        background-color: #eee;
      `}
    >
      <Columns
        pad={Pad.Medium}
        maxWidth
        className={css`
          padding: ${Pad.XLarge};
          background-color: #fff;
        `}
      >
        <Typography variant="h4" color="textPrimary" align="center">
          TrainingFor
        </Typography>
        <TextField
          label="Display name"
          variant="outlined"
          value={displayName}
          onChange={event => setDisplayName(event.target.value)}
        />
        <TextField
          label="Email"
          variant="outlined"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
        <form onSubmit={addUser}>
          <TextField
            fullWidth
            label="Password"
            variant="outlined"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </form>
        <Button variant="contained" color="primary" onClick={addUser}>
          Start Training
        </Button>
        <Button
          variant="text"
          color="primary"
          onClick={() => {
            history.push(Paths.logIn);
          }}
        >
          Log In
        </Button>
      </Columns>
    </div>
  );
};
