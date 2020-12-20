import React, { FC, useCallback, useState } from 'react';
import styled from '@emotion/styled';
import { TextField, Typography, Button, IconButton } from '@material-ui/core';
import { ArrowBackIosRounded } from '@material-ui/icons';
import { useHistory } from 'react-router-dom';
import { css } from '@emotion/css';

import { Columns, Pad } from '../style';
import { auth } from '../firebase';
import { Paths } from '../constants';

const LogInContainer = styled.div`
  height: 100vh;
  width: 100%;
  display: grid;
  place-items: center;
  background-color: #eee;
`;

const LogInCard = styled(Columns)`
  width: 100%;
  padding: ${Pad.XLarge};
  background-color: #fff;
`;

const LogInNav = styled.nav`
  position: absolute;
  top: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: ${Pad.Medium};
  height: min-content;
`;

export const LogIn: FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const history = useHistory();

  const logIn = useCallback(
    <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      try {
        auth.signInWithEmailAndPassword(email, password);
        setPassword('');
      } catch (error) {
        alert(error.message);
      }
    },
    [email, password]
  );

  const resetPassword = useCallback(() => {
    if (!email.length) return alert('Enter a valid email address.');
    try {
      auth.sendPasswordResetEmail(email);
    } catch (error) {
      alert(error.message);
    } finally {
      alert(`A password reset link has been sent to ${email}`);
    }
  }, [email]);

  return (
    <LogInContainer>
      <LogInNav>
        <IconButton
          aria-label="Navigate back"
          size="small"
          onClick={() => {
            history.push(Paths.welcome);
          }}
        >
          <ArrowBackIosRounded />
        </IconButton>
      </LogInNav>
      <LogInCard pad={Pad.Medium}>
        <Typography variant="h4" color="textPrimary" align="center">
          TrainingFor
        </Typography>
        <TextField
          label="Email"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
        <Columns pad={Pad.XSmall}>
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
          <button
            disabled={!email.length}
            className={css`
              border: 0;
              background-color: inherit;
              max-width: fit-content;
              margin: 0;
              padding: 0;
              color: ${!email.length ? 'lightgray' : 'gray'};
              font-size: 0.8em;
            `}
            onClick={resetPassword}
          >
            Reset Password
          </button>
        </Columns>
        <Button variant="contained" color="primary" onClick={logIn}>
          Start Training
        </Button>
      </LogInCard>
    </LogInContainer>
  );
};
