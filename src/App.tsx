import React, { FC, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import firebase from 'firebase/app';
import {
  BrowserRouter as Router,
  Route,
  Redirect,
  Switch,
} from 'react-router-dom';
import { CircularProgress, Typography } from '@material-ui/core';

import { Welcome } from './pages/Welcome';
import { TrainingLogEditor } from './pages/TrainingLogEditor';
import { NewTraining } from './pages/NewTraining';
import { SignUp } from './pages/SignUp';
import { LogIn } from './pages/LogIn';
import { Account } from './pages/Account';
import { NavBar, navBarHeight } from './components/NavBar';
import { auth } from './firebase';
import { DataState, DataStateView } from './DataState';

const AppContainer = styled.div`
  width: 100%;
  height: 100%;
  max-width: 512px;
`;

const ViewWithNavBar = styled.div`
  width: 100%;
  height: calc(100% - ${navBarHeight}px);
`;

const CenteredContainer = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
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
          loading={() => (
            <CenteredContainer>
              <CircularProgress />
            </CenteredContainer>
          )}
          error={() => (
            <CenteredContainer>
              <Typography variant="body2" color="error">
                Something went wrong.
              </Typography>
            </CenteredContainer>
          )}
          empty={() => (
            <Switch>
              <Route exact path="/welcome">
                <Welcome />
              </Route>
              <Route exact path="/welcome/signup">
                <SignUp />
              </Route>
              <Route exact path="/welcome/login">
                <LogIn />
              </Route>
              <Route path="/">
                <Redirect to="/welcome" />
              </Route>
            </Switch>
          )}
        >
          {() => (
            <Switch>
              <Route exact path="/log/:logId">
                <ViewWithNavBar>
                  <TrainingLogEditor />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route exact path="/timeline">
                <ViewWithNavBar>
                  <div>Unimplemented</div>
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route exact path="/account">
                <ViewWithNavBar>
                  <Account />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route exact path="/">
                <ViewWithNavBar>
                  <NewTraining />
                  <NavBar />
                </ViewWithNavBar>
              </Route>
              <Route path="/">
                <Redirect to="/" />
              </Route>
            </Switch>
          )}
        </DataStateView>
      </Router>
    </AppContainer>
  );
};
