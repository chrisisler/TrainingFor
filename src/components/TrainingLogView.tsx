import { css } from '@emotion/css';
import { ClickAwayListener, IconButton, Menu, MenuItem, Typography } from '@material-ui/core';
import format from 'date-fns/format';
import React, { FC, useCallback } from 'react';
import { toast } from 'react-toastify';

import { Format, Paths } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import { ActivitySetStatus, TrainingLog, TrainingTemplate } from '../interfaces';
import { Color, Columns, Pad, Rows } from '../style';
import { ActivityView } from './ActivityView';
import { AppLink } from './AppLink';

export const activityViewContainerStyle = css`
  display: flex;
  flex-direction: column;
`;

/**
 * Create a new Template entry in the given `toUserId` users' templates
 * collection. Copies activities from the given pre-existing log.
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
  // Create a new template and get a ref to it, and get all log activities
  const [newTemplateRef, logActivities] = await Promise.all([
    db.user(toUserId).collection(DbPath.UserTemplates).add(newTemplate),
    db
      .user(log.authorId)
      .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
      .doc(log.id)
      .collection(DbPath.UserLogActivities)
      .withConverter(DbConverter.Activity)
      .get()
      .then(snapshot => snapshot.docs.map(doc => doc.data())),
  ]);
  // Get a reference to the activities of the new template
  const templateActivities = newTemplateRef.collection(DbPath.UserLogActivities);
  const batch = db.batch();
  // Reset each set.status of each activity to Unattempted (or Optional)
  logActivities.forEach(activity => {
    activity.sets.forEach(activitySet => {
      if (activitySet.status === ActivitySetStatus.Optional) return; // Skip
      activitySet.status = ActivitySetStatus.Unattempted;
    });
    batch.set(templateActivities.doc(), activity);
  });
  // Make all changes to the new template activities at once, failing if any
  // one of them fails
  await batch.commit();
  // Give the callee the ID of the new template
  return newTemplateRef.id;
};

/**
 * Read-only view of a TrainingLog.
 * This component is for viewing logs not authored by the authenticated user.
 */
// TODO Update to look like the Editor
export const TrainingLogView: FC<{ log: TrainingLog | TrainingTemplate }> = ({ log }) => {
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
                  <Menu
                    id="log-menu"
                    anchorEl={menu.ref}
                    open={!!menu.ref}
                    onClose={menu.close}
                    MenuListProps={{ dense: true }}
                  >
                    {!!window.navigator.share && (
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
                    {isTemplate && (
                      <MenuItem onClick={copyTemplate}>Add to your Templates</MenuItem>
                    )}
                  </Menu>
                </div>
              </ClickAwayListener>
            </Rows>
          </Columns>
          <div className={activityViewContainerStyle}>
            {activities.map(({ id }, index) => (
              <ActivityView key={id} activities={activities} index={index} log={log} />
            ))}
          </div>
        </div>
      )}
    </DataStateView>
  );
};

// TODO Get rid of this
export const TrainingLogDateView: FC<{
  log: TrainingLog | TrainingTemplate;
}> = ({ log }) => {
  if (TrainingLog.isTemplate(log)) {
    return (
      <Typography
        variant="body2"
        color="textSecondary"
        className={css`
          width: min-content;
        `}
      >
        Training Template
      </Typography>
    );
  }

  const _date = TrainingLog.getDate(log);
  const date: DataState<[string, string]> = _date
    ? [format(_date, Format.date), format(_date, Format.time)]
    : DataState.Empty;

  return (
    <DataStateView data={date} loading={() => null} error={() => null}>
      {([date, time]) => (
        <Columns>
          <Typography
            variant="body2"
            color="textSecondary"
            className={css`
              white-space: nowrap;
            `}
          >
            {date}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {time}
          </Typography>
        </Columns>
      )}
    </DataStateView>
  );
};
