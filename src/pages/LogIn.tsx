import React, { FC, useCallback, useState } from 'react';
import styled from '@emotion/styled';
import { TextField, Typography, Button, IconButton } from '@material-ui/core';
import { ArrowBackIosRounded } from '@material-ui/icons';
import { useHistory } from 'react-router-dom';

import { Columns, Pad } from '../style';
import { auth } from '../firebase';

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

  return (
    <LogInContainer>
      <LogInNav>
        <IconButton
          aria-label="Navigate back"
          size="small"
          onClick={() => {
            history.push('/welcome');
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
        ></TextField>
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
        <Button variant="contained" color="primary" onClick={logIn}>
          Start Training
        </Button>
      </LogInCard>
    </LogInContainer>
  );
};
