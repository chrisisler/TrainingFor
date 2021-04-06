import { css } from '@emotion/css';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@material-ui/core';
import format from 'date-fns/format';
import React, { FC, useCallback, useEffect, useState } from 'react';
import FlipMove from 'react-flip-move';
import { toast } from 'react-toastify';

import { Format, Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import {
  Activity,
  ActivityRepCountUnit,
  ActivityStatus,
  ActivityWeightUnit,
  TrainingLog,
  TrainingTemplate,
} from '../interfaces';
import { Color, Columns, Pad, Rows } from '../style';
import { ActivityView } from './ActivityView';
import { AppLink } from './AppLink';

const activityViewContainerStyle = css`
  display: flex;
  flex-direction: column;

  & > :not(:last-child) {
    border-bottom: 1px solid ${Color.ActionSecondaryGray};
    margin-bottom: ${Pad.Medium};
  }
`;

/**
 * Create a new Template entry in the authenticated users' templates collection.
 * Copies activities from the given pre-existing log. The log is created in the provided user ID's
 * templates collection.
 *
 * @returns The ID of the newly created Template.
 */
export const createTemplateFromLog = async (
  /** The log or template from which to copy Activities from. */
  log: TrainingLog | TrainingTemplate,
  /** The User for whom this Template will be created for. */
  toUserId: string
): Promise<string> => {
  const newTemplate = TrainingTemplate.create({
    title: log.title,
    authorId: toUserId,
  }) as TrainingTemplate;
  const isTemplate = TrainingLog.isTemplate(log);
  const [newTemplateRef, logActivities] = await Promise.all([
    db.user(toUserId).collection(DbPath.UserTemplates).add(newTemplate),
    db
      .user(log.authorId)
      .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
      .doc(log.id)
      .collection(DbPath.UserLogActivities)
      .withConverter(DbConverter.Activity)
      .get()
      .then(snapshot =>
        snapshot.docs.map(doc => {
          const activity = doc.data();
          activity.sets.forEach(({ status }) => {
            if (status === ActivityStatus.Optional) return;
            status = ActivityStatus.Unattempted;
          });
          return activity;
        })
      ),
  ]);
  const templateActivities = newTemplateRef.collection(
    DbPath.UserLogActivities
  );
  const batch = db.batch();
  logActivities.forEach(a => batch.set(templateActivities.doc(a.id), a));
  await batch.commit();
  return newTemplateRef.id;
};

export const TrainingLogEditorView: FC<{
  log: TrainingLog | TrainingTemplate;
}> = ({ log }) => {
  const [activities, setActivities] = useState<DataState<Activity[]>>(
    DataState.Loading
  );

  const isTemplate = TrainingLog.isTemplate(log);

  useEffect(() => {
    return db
      .user(log.authorId)
      .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
      .doc(log.id)
      .collection(DbPath.UserLogActivities)
      .withConverter(DbConverter.Activity)
      .orderBy('position', 'asc')
      .onSnapshot(
        snapshot =>
          setActivities(
            snapshot.docs.map(doc => {
              const activity = doc.data();
              // Patch the fields not present in old data
              if (!activity.repCountUnit) {
                activity.repCountUnit = ActivityRepCountUnit.Repetitions;
              }
              if (!activity.weightUnit) {
                activity.weightUnit = ActivityWeightUnit.Pounds;
              }
              return activity;
            })
          ),
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
              <ActivityView
                key={id}
                editable
                activities={activities}
                index={index}
                log={log}
              />
            ))}
          </FlipMove>
        ) : (
          <Typography
            variant="body1"
            color="textSecondary"
            className={css`
              padding: ${Pad.Large};
            `}
          >
            No activities!
          </Typography>
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

  const menu = useMaterialMenu();
  const user = useUser();

  const [authorName] = useDataState<string>(
    () =>
      db
        .user(log.authorId)
        .get()
        .then(doc => doc.get('displayName')),
    [log.authorId]
  );

  const [activities] = useDataState(
    () =>
      db
        .user(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .orderBy('position', 'asc')
        .get()
        .then(snapshot => snapshot.docs.map(doc => doc.data())),
    [log.authorId, log.id]
  );

  const copyTemplate = useCallback(async () => {
    menu.close();
    if (!TrainingLog.isTemplate(log)) return;
    try {
      await createTemplateFromLog(log, user.uid);
      toast.info(`Added ${log.title} to your templates.`);
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, menu, user.uid]);

  return (
    <DataStateView data={activities} error={() => null} loading={() => null}>
      {activities => (
        <div
          className={css`
            border-bottom: 1px solid ${Color.ActionSecondaryGray};
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
              <ClickAwayListener onClickAway={menu.close}>
                <div>
                  <IconButton
                    aria-label="Open log menu"
                    aria-controls="log-menu"
                    aria-haspopup="true"
                    onClick={menu.open}
                    className={css`
                      padding: 0 !important;
                    `}
                  >
                    <Typography variant="body1" color="textPrimary">
                      {log.title}
                    </Typography>
                  </IconButton>
                  {window.navigator.share && (
                    <MenuItem
                      onClick={() => {
                        menu.close();
                        const url = isTemplate
                          ? Paths.templateView(log.authorId, log.id)
                          : Paths.logView(log.authorId, log.id);
                        window.navigator.share({ url });
                      }}
                    >
                      Share link
                    </MenuItem>
                  )}
                  <Menu
                    id="log-menu"
                    anchorEl={menu.ref}
                    open={!!menu.ref}
                    onClose={menu.close}
                    MenuListProps={{ dense: true }}
                  >
                    {isTemplate && (
                      <MenuItem onClick={copyTemplate}>
                        Add to your Templates
                      </MenuItem>
                    )}
                  </Menu>
                </div>
              </ClickAwayListener>
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
