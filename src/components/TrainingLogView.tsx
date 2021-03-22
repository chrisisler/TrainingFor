import { css } from '@emotion/css';
import { Typography } from '@material-ui/core';
import format from 'date-fns/format';
import React, { FC, useEffect, useState } from 'react';
import FlipMove from 'react-flip-move';

import { Format, Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { Activity, TrainingLog, TrainingTemplate } from '../interfaces';
import { Columns, Pad, Rows } from '../style';
import { ActivityView } from './ActivityView';
import { AppLink } from './AppLink';
import { FlipMoveChild } from './FlipMoveChild';

const activityViewContainerStyle = css`
  display: flex;
  flex-direction: column;
`;

export const TrainingLogEditorView: FC<{
  log: TrainingLog | TrainingTemplate;
}> = ({ log }) => {
  const [activities, setActivities] = useState<DataState<Activity[]>>(
    DataState.Loading
  );

  const isTemplate = TrainingLog.isTemplate(log);

  useEffect(() => {
    return db
      .collection(DbPath.Users)
      .doc(log.authorId)
      .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
      .doc(log.id)
      .collection(DbPath.UserLogActivities)
      .withConverter(DbConverter.Activity)
      .orderBy('position', 'asc')
      .onSnapshot(
        snapshot => setActivities(snapshot.docs.map(doc => doc.data())),
        error => setActivities(DataState.error(error.message))
      );
  }, [log.authorId, log.id, isTemplate]);

  return (
    <DataStateView data={activities}>
      {activities =>
        activities.length ? (
          <FlipMove
            enterAnimation="fade"
            leaveAnimation="fade"
            className={css`
              height: 100%;
              width: 100%;
              overflow-y: scroll;
              ${activityViewContainerStyle}
            `}
          >
            {activities.map(({ id }, index) => (
              <FlipMoveChild key={id}>
                <ActivityView
                  editable
                  activities={activities}
                  index={index}
                  log={log}
                />
              </FlipMoveChild>
            ))}
          </FlipMove>
        ) : (
          <FlipMove enterAnimation="fade" leaveAnimation="fade">
            <FlipMoveChild>
              <Typography
                variant="body1"
                color="textSecondary"
                className={css`
                  padding: ${Pad.Large};
                `}
              >
                No activities!
              </Typography>
            </FlipMoveChild>
          </FlipMove>
        )
      }
    </DataStateView>
  );
};

/**
 * Read-only view of a TrainingLog.
 * This component is for viewing logs not authored by the authenticated user.
 */
// TODO Update to look like the Editor
export const TrainingLogView: FC<{ log: TrainingLog | TrainingTemplate }> = ({
  log,
}) => {
  const logDate = TrainingLog.getDate(log);
  const isTemplate = TrainingLog.isTemplate(log);

  const [authorName] = useDataState<string>(
    () =>
      db
        .collection(DbPath.Users)
        .doc(log.authorId)
        .get()
        .then(doc => doc.get('displayName')),
    [log.authorId]
  );

  const [activities] = useDataState(
    () =>
      db
        .collection(DbPath.Users)
        .doc(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .orderBy('position', 'asc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data())),
    [log.authorId, log.id]
  );

  return (
    <DataStateView data={activities} error={() => null} loading={() => null}>
      {activities => (
        <div
          className={css`
            border-bottom: 1px solid lightgray;
          `}
        >
          <Columns padding={`${Pad.Medium}`}>
            {DataState.isReady(authorName) && (
              <Typography variant="body1" color="textPrimary">
                <AppLink to={Paths.user(log.authorId)}>{authorName}</AppLink>
              </Typography>
            )}
            <Rows maxWidth between>
              {!isTemplate && logDate && (
                <Typography variant="body2" color="textSecondary">
                  {format(logDate, Format.date)}
                  <br />
                  {format(logDate, Format.time)}
                </Typography>
              )}
              {isTemplate && <TrainingLogDateView log={log} />}
              <Typography variant="body1" color="textPrimary">
                {log.title}
              </Typography>
            </Rows>
          </Columns>
          <div className={activityViewContainerStyle}>
            {activities.map(({ id }, index) => (
              <ActivityView
                key={id}
                activities={activities}
                index={index}
                log={log}
              />
            ))}
          </div>
        </div>
      )}
    </DataStateView>
  );
};

export const TrainingLogDateView: FC<{
  log: TrainingLog | TrainingTemplate;
}> = ({ log }) => {
  const isTemplate = TrainingLog.isTemplate(log);
  const _date = TrainingLog.getDate(log);
  const date = _date ? format(_date, Format.time) : DataState.Empty;

  return (
    <Typography variant="body2" color="textSecondary">
      {isTemplate ? (
        <i>
          <b>Training Template</b>
        </i>
      ) : (
        <DataStateView
          data={date}
          loading={() => <>Loading...</>}
          error={() => null}
        >
          {date => <>{date}</>}
        </DataStateView>
      )}
    </Typography>
  );
};
