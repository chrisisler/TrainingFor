import React, { FC } from 'react';
import styled from '@emotion/styled';
import { Button, Typography } from '@material-ui/core';

import { Pad, Columns } from '../style';

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
        <Button variant="outlined" color="primary" href="signup">
          Sign Up
        </Button>
        <Button variant="outlined" href="login">
          Log In
        </Button>
      </WelcomeCard>
    </WelcomeContainer>
  );
};
