import { css } from '@emotion/css';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
} from '@material-ui/core';
import { MoreVert } from '@material-ui/icons';
import firebase from 'firebase/app';
import React, { FC, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Paths } from '../constants';
import { db, DbConverter, DbPath } from '../firebase';
import { useMaterialMenu, useUser } from '../hooks';
import { ActivityStatus, TrainingLog, TrainingTemplate } from '../interfaces';
import { Color } from '../style';

/**
 * Presents a menu icon with menu options to act on the given TrainingLog.
 */
export const TrainingLogMenuButton: FC<{
  log: TrainingLog | TrainingTemplate;
}> = ({ log }) => {
  const user = useUser();
  const menu = useMaterialMenu();
  const history = useHistory();

  const isTemplate = TrainingLog.isTemplate(log);

  /** Create new template entry in collections then open it in the editor. */
  const createTemplate = useCallback(async () => {
    if (isTemplate) return;
    if (!window.confirm('Create a Template from this log?')) return;
    try {
      const newTemplate: TrainingTemplate = {
        ...log,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        logIds: [log.id],
      };
      const templateRefP = db
        .collection(DbPath.Users)
        .doc(user.uid)
        .collection(DbPath.UserTemplates)
        .add(newTemplate);
      const activitiesP = db
        .collection(DbPath.Users)
        .doc(user.uid)
        .collection(DbPath.UserLogs)
        .doc(log.id)
        .collection(DbPath.UserLogActivities)
        .withConverter(DbConverter.Activity)
        .get()
        .then(snapshot =>
          snapshot.docs.map(doc => {
            const activity = doc.data();
            activity.sets.forEach(set => {
              set.status = ActivityStatus.Unattempted;
            });
            return activity;
          })
        );
      const [templateRef, activities] = await Promise.all([
        templateRefP,
        activitiesP,
      ]);
      const templateActivities = templateRef.collection(
        DbPath.UserLogActivities
      );
      const writeBatch = db.batch();
      activities.forEach(a => {
        // Create a document with A's ID assigned to A's data
        writeBatch.set(templateActivities.doc(a.id), a);
      });
      await writeBatch.commit();
      // Navigate to the newly created template if nothing went wrong
      history.push(Paths.template(templateRef.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, user.uid, history, isTemplate]);

  const deleteLog = useCallback(async () => {
    if (log.authorId !== user.uid) return;
    if (!window.confirm(`Delete "${log.title}" forever?`)) return;
    try {
      await db
        .collection(DbPath.Users)
        .doc(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .delete();
      history.push(Paths.newTraining);
      toast.info('Deleted successfully!');
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, log, history, isTemplate]);

  // Render nothing if the logged-in user is not the owner of the given log
  if (log.authorId !== user.uid) return null;

  return (
    <ClickAwayListener onClickAway={menu.close}>
      <div>
        <IconButton
          aria-label="Open log menu"
          aria-controls="log-menu"
          aria-haspopup="true"
          onClick={menu.open}
          size="small"
        >
          <MoreVert
            className={css`
              color: ${Color.ActionSecondaryGray};
            `}
          />
        </IconButton>
        <Menu
          id="log-menu"
          anchorEl={menu.ref}
          open={!!menu.ref}
          onClose={menu.close}
          MenuListProps={{ dense: true }}
        >
          {!isTemplate && (
            <MenuItem onClick={createTemplate}>Create Template</MenuItem>
          )}
          <MenuItem onClick={deleteLog}>
            <b>Delete Training {isTemplate ? 'Template' : 'Log'}</b>
          </MenuItem>
        </Menu>
      </div>
    </ClickAwayListener>
  );
};
