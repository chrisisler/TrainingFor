import { css } from '@emotion/css';
import { Button, TextField, Typography } from '@material-ui/core';
import React, { FC, useCallback, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { v4 as uuid } from 'uuid';

import { Paths } from '../constants';
import { auth } from '../firebase';
import { Color, Columns, Font, Pad, Rows } from '../style';

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

  // How is the Account page able to work when we aren't adding the user.id as
  // a Users firestore collection entry?
  const continueAsGuest = useCallback(async () => {
    if (!window.confirm('Continue as guest?')) return;
    try {
      const { user } = await auth.signInAnonymously();
      if (!user) throw Error('No user found');
      const displayName = `Guest-${uuid().slice(0, 5)}`;
      await user.updateProfile({ displayName });
    } catch (error) {
      toast.error(error.message);
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
        padding: 0 ${Pad.Medium};
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
        <Typography variant="h5" color="textPrimary" align="center">
          TrainingFor
        </Typography>
        <TextField
          label="Email"
          variant="outlined"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
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
        <Button
          variant="contained"
          color="primary"
          onClick={logIn}
          disabled={!email || !password}
        >
          Log In
        </Button>
        <Button
          size="small"
          variant="text"
          component={NavLink}
          color="primary"
          to={Paths.signUp}
        >
          Sign Up
        </Button>
        <Rows between>
          <button
            className={css`
              border: 0;
              background-color: inherit;
              max-width: fit-content;
              margin: 0;
              padding: 0;
              color: ${Color.ActionPrimaryGray};
              font-size: ${Font.Small};
            `}
            onClick={continueAsGuest}
          >
            Continue as Guest
          </button>
          <button
            className={css`
              border: 0;
              background-color: inherit;
              max-width: fit-content;
              margin: 0;
              padding: 0;
              color: ${Color.ActionPrimaryGray};
              font-size: ${Font.Small};
            `}
            onClick={resetPassword}
          >
            Reset Password
          </button>
        </Rows>
      </Columns>
    </div>
  );
};
