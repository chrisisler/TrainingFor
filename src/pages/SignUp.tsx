import styled from '@emotion/styled';
import { Button, IconButton, TextField, Typography } from '@material-ui/core';
import { ArrowBackIosRounded } from '@material-ui/icons';
import firebase from 'firebase/app';
import React, { FC, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Paths } from '../constants';
import { auth, db, DbPath } from '../firebase';
import { User } from '../interfaces';
import { Columns, Pad } from '../style';

const SignUpContainer = styled.div`
  height: 100vh;
  width: 100%;
  display: grid;
  place-items: center;
  background-color: #eee;
`;

const SignUpCard = styled(Columns)`
  width: 100%;
  padding: ${Pad.XLarge};
  background-color: #fff;
`;

const SignUpNav = styled.nav`
  position: absolute;
  top: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: ${Pad.Medium};
  height: min-content;
`;

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
    <SignUpContainer>
      <SignUpNav>
        <IconButton
          aria-label="Navigate back"
          size="small"
          onClick={() => {
            history.push(Paths.welcome);
          }}
        >
          <ArrowBackIosRounded />
        </IconButton>
      </SignUpNav>
      <SignUpCard pad={Pad.Medium}>
        <Columns>
          <Typography variant="h4" color="textPrimary" align="center">
            TrainingFor
          </Typography>
        </Columns>
        <TextField
          label="Display name"
          value={displayName}
          onChange={event => setDisplayName(event.target.value)}
        />
        <TextField
          label="Email"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
        <Button variant="contained" color="primary" onClick={addUser}>
          Start Training
        </Button>
      </SignUpCard>
    </SignUpContainer>
  );
};
