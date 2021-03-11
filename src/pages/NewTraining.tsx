import { css } from '@emotion/css';
import { Button } from '@material-ui/core';
import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import React, { FC } from 'react';
import { useHistory } from 'react-router-dom';

import { Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useNewTraining, useUser } from '../hooks';
import { TrainingLog } from '../interfaces';
import { Columns, Pad } from '../style';

export const NewTraining: FC = () => {
  const newTraining = useNewTraining();
  const user = useUser();
  const history = useHistory();

  const [prevLog] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(user.uid)
        .collection(DbPath.UserLogs)
        .withConverter(DbConverter.TrainingLog)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()
        .then(({ empty, docs }) => (empty ? DataState.Empty : docs[0].data())),
    [user.uid]
  );

  const prevLogDate = DataState.map<TrainingLog, Date>(
    prevLog,
    log => TrainingLog.getDate(log) ?? DataState.Empty
  );

  return (
    <div
      className={css`
        height: 100%;
        width: 100%;
        display: grid;
        place-items: center;
        padding: 0 ${Pad.Large};
      `}
    >
      <Columns
        pad={Pad.Small}
        className={css`
          text-align: center;
        `}
        maxWidth
      >
        <Button variant="contained" color="primary" onClick={newTraining}>
          Go
        </Button>
        <Button
          disabled={!DataState.isReady(prevLogDate)}
          variant="text"
          color="primary"
          onClick={() => {
            if (!DataState.isReady(prevLog)) return;
            history.push(Paths.logEditor(prevLog.id));
          }}
        >
          <DataStateView
            data={prevLogDate}
            error={() => <>No previous training</>}
            loading={() => <>Loading previous training...</>}
          >
            {prevLogDate => (
              <>
                Or continue from{' '}
                {formatDistanceToNowStrict(prevLogDate, {
                  addSuffix: true,
                })}
              </>
            )}
          </DataStateView>
        </Button>
      </Columns>
    </div>
  );
};
