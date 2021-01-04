import { css } from '@emotion/css';
import { IconButton } from '@material-ui/core';
import { ArrowBackIosRounded } from '@material-ui/icons';
import React, { FC } from 'react';
import { useHistory, useParams } from 'react-router-dom';

import { TrainingLogView } from '../components/TrainingLogView';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { Pad, Rows } from '../style';

export const TrainingLogViewPage: FC = () => {
  const history = useHistory();
  const { userId, logId } = useParams<{ userId?: string; logId?: string }>();

  const [log] = useDataState(
    () =>
      !userId || !logId
        ? Promise.reject(DataState.error('Invalid route params'))
        : db
            .collection(DbPath.Users)
            .doc(userId)
            .collection(DbPath.UserLogs)
            .withConverter(DbConverter.TrainingLog)
            .doc(logId)
            .get()
            .then(doc => {
              const log = doc.data();
              if (!log) {
                return DataState.error('TrainingLog document does not exist.');
              }
              // The viewed user is the author the viewed log
              log.authorId = userId;
              return log;
            }),
    [userId, logId]
  );

  return (
    <div
      className={css`
        height: 100%;
        width: 100%;
        overflow-y: scroll;
      `}
    >
      <Rows maxWidth center padding={`0 ${Pad.Medium}`}>
        <IconButton aria-label="Go back" onClick={() => history.goBack()}>
          <ArrowBackIosRounded color="primary" />
        </IconButton>
      </Rows>
      <DataStateView data={log}>
        {log => <TrainingLogView log={log} />}
      </DataStateView>
    </div>
  );
};
