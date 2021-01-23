import { css } from '@emotion/css';
import { Button, Typography } from '@material-ui/core';
import React, { FC } from 'react';
import { NavLink } from 'react-router-dom';

import { Paths } from '../constants';
import { Columns, Pad } from '../style';

export const Welcome: FC = () => {
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
        pad={Pad.Large}
        className={css`
          width: 100%;
          padding: ${Pad.XLarge};
          background-color: #fff;
        `}
      >
        <Typography variant="h4" color="textPrimary" align="center">
          TrainingFor
        </Typography>
        <Button
          variant="contained"
          component={NavLink}
          color="primary"
          to={Paths.signUp}
        >
          Sign Up
        </Button>
        <Button
          variant="text"
          color="primary"
          component={NavLink}
          to={Paths.logIn}
        >
          Log In
        </Button>
      </Columns>
    </div>
  );
};
