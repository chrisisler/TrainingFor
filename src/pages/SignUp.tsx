import React, { FC, useState, useCallback } from 'react';
import styled from 'styled-components';
import { TextField, Typography, Button, IconButton } from '@material-ui/core';
import { ArrowBackIosRounded } from '@material-ui/icons';
import { useHistory } from 'react-router-dom';

import { auth } from '../firebase';
import { Columns, Pad } from '../style';
import { useUser } from '../useUser';

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
  border-bottom: 1px solid gray;
  height: min-content;
`;

export const SignUp: FC = () => {
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const history = useHistory();
  const [, setUser] = useUser();

  const signUp = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      try {
        const userCredential = await auth.createUserWithEmailAndPassword(
          email,
          password
        );
        setDisplayName('');
        setEmail('');
        setPassword('');
        await userCredential.user?.updateProfile({ displayName });
        setUser(userCredential.user);
      } catch (error) {
        alert(error.message);
      }
    },
    [displayName, email, password, setUser]
  );

  return (
    <SignUpContainer>
      <SignUpNav>
        <IconButton
          aria-label="Navigate back"
          size="small"
          onClick={() => {
            history.push('/');
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
        <Button variant="contained" color="primary" onClick={signUp}>
          Start Training
        </Button>
      </SignUpCard>
    </SignUpContainer>
  );
};
