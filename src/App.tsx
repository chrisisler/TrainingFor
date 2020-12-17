import React, { FC, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
  RouteProps,
  useLocation,
  useHistory,
} from 'react-router-dom';

import { Welcome } from './pages/Welcome';
import { StartTraining } from './pages/StartTraining';
import { NewTraining } from './pages/NewTraining';
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

const AuthenticatedRoute: FC<RouteProps> = ({ children, ...rest }) => {
  const [user] = useUser();
  return (
    <Route
      {...rest}
      render={() => (!!user ? children : <Redirect to="/welcome" />)}
    />
  );
};

const Routes: FC = () => {
  const [user] = useUser();

  console.log('user is:', user);

  return (
    <Switch>
      <Route exact path="/welcome">
        <Switch>
          <Route exact path="signup">
            <SignUp />
          </Route>
          <Route exact path="login">
            <LogIn />
          </Route>
          <Route path="/">
            <Welcome />
          </Route>
        </Switch>
      </Route>
      <AuthenticatedRoute exact path="/log/:logId">
        <ViewWithNavBar>
          <StartTraining />
          <NavBar />
        </ViewWithNavBar>
      </AuthenticatedRoute>
      <AuthenticatedRoute exact path="/timeline">
        <ViewWithNavBar>
          <div>Unimplemented</div>
          <NavBar />
        </ViewWithNavBar>
      </AuthenticatedRoute>
      <AuthenticatedRoute exact path="/account">
        <ViewWithNavBar>
          <Account />
          <NavBar />
        </ViewWithNavBar>
      </AuthenticatedRoute>
      <AuthenticatedRoute exact path="/">
        <ViewWithNavBar>
          <NewTraining />
          <NavBar />
        </ViewWithNavBar>
      </AuthenticatedRoute>
    </Switch>
  );
};

export const App: FC = () => {
  return (
    <AppContainer>
      <Router>
        <Routes />
      </Router>
    </AppContainer>
  );
};
