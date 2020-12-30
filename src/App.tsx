import styled from '@emotion/styled';
import { Typography } from '@material-ui/core';
import firebase from 'firebase/app';
import React, { FC, useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Redirect,
  Route,
  Switch,
} from 'react-router-dom';

import { NavBar, navBarHeight } from './components/NavBar';
import { Paths } from './constants';
import { DataState, DataStateView } from './DataState';
import { auth } from './firebase';
import { Account } from './pages/Account';
import { LogIn } from './pages/LogIn';
import { NewTraining } from './pages/NewTraining';
import { SignUp } from './pages/SignUp';
import { Timeline } from './pages/Timeline';
import { TrainingLogEditor } from './pages/TrainingLogEditor';
import { TrainingLogViewPage } from './pages/TrainingLogViewPage';
import { Welcome } from './pages/Welcome';

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
  const [user, setUser] = useState<DataState<firebase.User>>(DataState.Loading);

  useEffect(() => {
    return auth.onAuthStateChanged(
      authUser => {
        setUser(authUser ?? DataState.Empty);
      },
      error => {
        setUser(DataState.error(error.message));
      }
    );
  }, []);

  return (
    <AppContainer>
      <Router>
        <DataStateView
          data={user}
          error={() => (
            <Typography variant="body2" color="error">
              Something went wrong.
            </Typography>
          )}
          empty={() => (
            <Switch>
              <Route exact path={Paths.welcome}>
                <Welcome />
              </Route>
              <Route exact path={Paths.signUp}>
                <SignUp />
              </Route>
              <Route exact path={Paths.logIn}>
                <LogIn />
              </Route>
              <Route path="/">
                <Redirect to={Paths.welcome} />
              </Route>
            </Switch>
          )}
        >
          {() => (
            <Switch>
              <Route exact path={Paths.logView()}>
                <ViewWithNavBar>
                  <TrainingLogViewPage />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route exact path={Paths.user()}>
                <ViewWithNavBar>
                  <Account />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route exact path={Paths.logEditor()}>
                <ViewWithNavBar>
                  <TrainingLogEditor />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route exact path={Paths.timeline}>
                <ViewWithNavBar>
                  <Timeline />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route exact path={Paths.account}>
                <ViewWithNavBar>
                  <Account />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route exact path={Paths.newTraining}>
                <ViewWithNavBar>
                  <NewTraining />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route path="/">
                <Redirect to={Paths.newTraining} />
              </Route>
            </Switch>
          )}
        </DataStateView>
      </Router>
    </AppContainer>
  );
};
