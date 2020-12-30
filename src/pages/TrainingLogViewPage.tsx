import { css } from '@emotion/css';
import React, { FC } from 'react';
import { useParams } from 'react-router-dom';

import { TrainingLogView } from '../components/TrainingLogView';
import { DataStateView, useDataState } from '../DataState';
import { db, DbPath } from '../firebase';
import { TrainingLog } from '../interfaces';

export const TrainingLogViewPage: FC = () => {
  const { userId, logId } = useParams<{ userId?: string; logId?: string }>();

  const [log] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(userId)
        .collection(DbPath.UserLogs)
        .doc(logId)
        .get()
        .then(
          doc =>
            ({ ...doc.data(), id: doc.id, authorId: userId } as TrainingLog)
        ),
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
      <DataStateView data={log} error={() => null}>
        {log => <TrainingLogView log={log} />}
      </DataStateView>
    </div>
  );
};
