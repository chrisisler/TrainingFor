import React, { FC } from 'react';
import styled from 'styled-components';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

import { Welcome } from './pages/Welcome';
import { StartTraining } from './pages/StartTraining';
import { SignUp } from './pages/SignUp';
import { LogIn } from './pages/LogIn';
import { useUser } from './useUser';

const AppContainer = styled.div`
  width: 100%;
  height: 100%;
  max-width: 512px;
`;

export const App: FC = () => {
  const [user] = useUser();

  return (
    <AppContainer>
      <Router>
        <Switch>
          <Route path="/">
            {user === null ? <Welcome /> : <StartTraining />}
          </Route>
          <Route exact path="/signup">
            <SignUp />
          </Route>
          <Route exact path="/login">
            <LogIn />
          </Route>
        </Switch>
      </Router>
    </AppContainer>
  );
};
