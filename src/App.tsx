import 'react-toastify/dist/ReactToastify.min.css';

import { css } from '@emotion/css';
import firebase from 'firebase/app';
import React, { FC, useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Redirect,
  Route,
  Switch,
} from 'react-router-dom';
import { ToastContainer } from 'react-toastify';

import { ViewWithNavBar } from './components/NavBar';
import { Paths } from './constants';
import { DataState, DataStateView } from './DataState';
import { auth } from './firebase';
import { UserProvider } from './hooks';
import { Account } from './pages/Account';
import { Library } from './pages/Library';
import { LogIn } from './pages/LogIn';
import { NewTraining } from './pages/NewTraining';
import { SignUp } from './pages/SignUp';
import { Timeline } from './pages/Timeline';
import { TrainingLogEditor } from './pages/TrainingLogEditor';
import { TrainingLogViewPage } from './pages/TrainingLogViewPage';
import { Pad } from './style';

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
    <div
      className={css`
        width: 100%;
        height: 100%;
        max-width: 512px;
      `}
    >
      <ToastContainer
        hideProgressBar
        pauseOnFocusLoss={false}
        autoClose={3000}
        className={css`
          & > *:not(:last-child) {
            margin-bottom: ${Pad.XSmall};
          }
        `}
        toastClassName={css`
          border-radius: 8px;
          font-weight: 500;
          text-align: center;
          word-break: break-word;
        `}
      />
      <Router>
        <DataStateView
          data={user}
          empty={() => (
            <Switch>
              <Route exact path={Paths.logIn}>
                <LogIn />
              </Route>
              <Route exact path={Paths.signUp}>
                <SignUp />
              </Route>
              <Route path="/">
                <Redirect to={Paths.logIn} />
              </Route>
            </Switch>
          )}
        >
          {user => (
            <UserProvider user={user}>
              <Switch>
                <Route exact path={[Paths.logView(), Paths.templateView()]}>
                  <ViewWithNavBar>
                    <TrainingLogViewPage />
                  </ViewWithNavBar>
                </Route>
                <Route exact path={[Paths.logEditor(), Paths.templateEditor()]}>
                  <ViewWithNavBar>
                    <TrainingLogEditor />
                  </ViewWithNavBar>
                </Route>
                <Route exact path={Paths.timeline}>
                  <ViewWithNavBar>
                    <Timeline />
                  </ViewWithNavBar>
                </Route>
                <Route exact path={[Paths.account, Paths.user()]}>
                  <ViewWithNavBar>
                    <Account />
                  </ViewWithNavBar>
                </Route>
                <Route exact path={Paths.library()}>
                  <ViewWithNavBar>
                    <Library />
                  </ViewWithNavBar>
                </Route>
                <Route exact path={Paths.training}>
                  <ViewWithNavBar>
                    <NewTraining />
                  </ViewWithNavBar>
                </Route>
                <Route path="/">
                  <Redirect to={Paths.training} />
                </Route>
              </Switch>
            </UserProvider>
          )}
        </DataStateView>
      </Router>
    </div>
  );
};
