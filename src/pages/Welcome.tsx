import styled from '@emotion/styled';
import { Button, Typography } from '@material-ui/core';
import React, { FC } from 'react';
import { NavLink } from 'react-router-dom';

import { Paths } from '../constants';
import { Columns, Pad } from '../style';

const WelcomeContainer = styled.div`
  height: 100vh;
  width: 100%;
  display: grid;
  place-items: center;
  background-color: #eee;
`;

const WelcomeCard = styled(Columns)`
  width: 100%;
  padding: ${Pad.XLarge};
  background-color: #fff;
`;

export const Welcome: FC = () => {
  return (
    <WelcomeContainer>
      <WelcomeCard pad={Pad.Large}>
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
      </WelcomeCard>
    </WelcomeContainer>
  );
};
