import React, { FC, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/css';
import { Typography, CircularProgress } from '@material-ui/core';
import firebase from 'firebase/app';
import { useHistory } from 'react-router-dom';
import format from 'date-fns/format';

import { Pad, Columns } from '../style';
import { useUser } from '../useUser';
import { db, DbPath } from '../firebase';
import { TrainingLog } from '../interfaces';
import { DataState, DataStateView } from '../DataState';
import { Format } from '../constants';

const CenteredContainer = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
`;

export const Account: FC = () => {
  const [logs, setLogs] = useState<DataState<TrainingLog[]>>(DataState.Loading);

  const history = useHistory();
  const [user] = useUser();

  useEffect(() => {
    if (!user) return;
    return db
      .collection(DbPath.Users)
      .doc(user?.uid)
      .collection(DbPath.UserLogs)
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        ({ docs }) =>
          setLogs(
            docs.map(doc => ({ ...doc.data(), id: doc.id } as TrainingLog))
          ),
        error => setLogs(DataState.error(error.message))
      );
  }, [user, user?.uid]);

  if (!user) return null;

  return (
    <Columns
      pad={Pad.Small}
      padding={Pad.Large}
      className={css`
        height: 100%;
        overflow-y: scroll;
      `}
    >
      <Typography variant="h4" color="textSecondary" gutterBottom>
        {user.displayName}
      </Typography>
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Training Logs
      </Typography>
      <DataStateView
        data={logs}
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
      >
        {logs => (
          <Columns pad={Pad.Large}>
            {logs.map(({ id, title, timestamp }) => {
              const logDate = (timestamp as firebase.firestore.Timestamp)?.toDate();
              return (
                <Columns
                  key={id}
                  onClick={() => history.push(`/log/${id}`)}
                  className={css`
                    border-radius: 5px;
                    box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.1);
                    padding: ${Pad.Medium};
                  `}
                >
                  <Typography variant="body1" color="textSecondary">
                    {title}
                  </Typography>
                  <Typography variant="body1" color="textPrimary">
                    {format(logDate, `${Format.date} - ${Format.time}`)}
                  </Typography>
                </Columns>
              );
            })}
          </Columns>
        )}
      </DataStateView>
    </Columns>
  );
};
