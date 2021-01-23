import { css } from '@emotion/css';
import styled from '@emotion/styled';
import { Button, IconButton, TextField, Typography } from '@material-ui/core';
import { ArrowBackIosRounded } from '@material-ui/icons';
import React, { FC, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Paths } from '../constants';
import { auth } from '../firebase';
import { Columns, Pad } from '../style';

const LogInCard = styled(Columns)`
  width: 100%;
  padding: ${Pad.XLarge};
  background-color: #fff;
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
        toast.error(error.message);
      }
    },
    [email, password]
  );

  const resetPassword = useCallback(() => {
    const email = window.prompt(
      'Please provide the email address associated with the account.'
    );
    if (!email) return;
    try {
      auth.sendPasswordResetEmail(email);
    } catch (error) {
      toast.error(error.message);
    } finally {
      toast.error(`A password reset link has been sent to ${email}`);
    }
  }, []);

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
      <nav
        className={css`
          position: absolute;
          top: 0;
          width: 100%;
          display: flex;
          justify-content: space-between;
          padding: ${Pad.Medium};
          height: min-content;
        `}
      >
        <IconButton
          aria-label="Navigate back"
          size="small"
          onClick={() => {
            history.push(Paths.welcome);
          }}
        >
          <ArrowBackIosRounded />
        </IconButton>
      </nav>
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
            className={css`
              border: 0;
              background-color: inherit;
              max-width: fit-content;
              margin: 0;
              padding: 0;
              color: gray;
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
    </div>
  );
};
