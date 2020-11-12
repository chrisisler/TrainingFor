import React, { FC } from 'react';
import styled from 'styled-components';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

import { Welcome } from './pages/Welcome';
import { StartTraining } from './pages/StartTraining';
import { SignUp } from './pages/SignUp';
import { LogIn } from './pages/LogIn';
import { Account } from './pages/Account';
import { NavBar, navBarHeight } from './components/NavBar';
import { useUser } from './useUser';

const AppContainer = styled.div`
  width: 100%;
  height: 100%;
  max-width: 512px;
`;

const ViewWithNavBar = styled.div`
  width: 100%;
  height: calc(100% - ${navBarHeight}px);
`;

export const App: FC = () => {
  const [user] = useUser();

  return (
    <AppContainer>
      <Router>
        <Switch>
          <Route exact path="/timeline">
            <div>Unimplemented</div>
          </Route>
          <Route exact path="/account">
            <ViewWithNavBar>
              <Account />
              <NavBar />
            </ViewWithNavBar>
          </Route>
          <Route exact path="/signup">
            <SignUp />
          </Route>
          <Route exact path="/login">
            <LogIn />
          </Route>
          <Route exact path="/:logId">
            <ViewWithNavBar>
              <StartTraining />
              <NavBar />
            </ViewWithNavBar>
          </Route>
          <Route path="/">
            {user === null ? (
              <Welcome />
            ) : (
              <ViewWithNavBar>
                <StartTraining />
                <NavBar />
              </ViewWithNavBar>
            )}
          </Route>
        </Switch>
      </Router>
    </AppContainer>
  );
};
