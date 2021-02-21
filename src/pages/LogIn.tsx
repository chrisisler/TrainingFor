import { css } from '@emotion/css';
import { Button, TextField, Typography } from '@material-ui/core';
import React, { FC, useCallback, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Paths } from '../constants';
import { auth } from '../firebase';
import { Color, Columns, Font, Pad } from '../style';

export const LogIn: FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const logIn = useCallback(
    async <E extends React.SyntheticEvent>(event: E) => {
      event.preventDefault();
      try {
        setPassword('');
        await auth.signInWithEmailAndPassword(email, password);
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
          label="Email"
          variant="outlined"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
        <Columns pad={Pad.XSmall}>
          <form onSubmit={logIn}>
            <TextField
              fullWidth
              variant="outlined"
              label="Password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </form>
          <button
            className={css`
              border: 0;
              background-color: inherit;
              max-width: fit-content;
              margin: 0;
              padding: 0;
              color: ${Color.ActionPrimaryGray};
              font-size: ${Font.Small};
              margin-left: auto;
            `}
            onClick={resetPassword}
          >
            Reset Password
          </button>
        </Columns>
        <Button variant="contained" color="primary" onClick={logIn}>
          Start Training
        </Button>
        <Button
          variant="text"
          component={NavLink}
          color="primary"
          to={Paths.signUp}
        >
          Sign Up
        </Button>
      </Columns>
    </div>
  );
};
