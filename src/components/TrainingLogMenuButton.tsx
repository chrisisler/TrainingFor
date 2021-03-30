import { css } from '@emotion/css';
import {
  ClickAwayListener,
  IconButton,
  Menu,
  MenuItem,
} from '@material-ui/core';
import { MoreHoriz } from '@material-ui/icons';
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
 * Presents a menu icon with menu options to act on the given
 * TrainingLog(Template).
 */
export const TrainingLogMenuButton: FC<{
  log: TrainingLog | TrainingTemplate;
}> = ({ log }) => {
  const user = useUser();
  const menu = useMaterialMenu();
  const history = useHistory();

  const isOwned = log.authorId === user.uid;
  const isTemplate = TrainingLog.isTemplate(log);

  const createTemplate = useCallback(async () => {
    if (isTemplate) return;
    if (!window.confirm('Create a Template from this log?')) return;
    try {
      const newTemplate: TrainingTemplate = {
        ...log,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        logIds: [],
      };
      const templateRefP = db
        .user(user.uid)
        .collection(DbPath.UserTemplates)
        .add(newTemplate);
      const logDoc = db.user(user.uid).collection(DbPath.UserLogs).doc(log.id);
      const activitiesP = logDoc
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
      const [templateRef, logActivities] = await Promise.all([
        templateRefP,
        activitiesP,
      ]);
      const templateActivities = templateRef.collection(
        DbPath.UserLogActivities
      );
      const batch = db.batch();
      logActivities.forEach(a => batch.set(templateActivities.doc(a.id), a));
      await batch.commit();
      if (isOwned && window.confirm('Delete original log?')) {
        await logDoc.delete();
        toast.info('Deleted original log.');
      }
      history.push(Paths.template(templateRef.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [log, user.uid, history, isTemplate, isOwned]);

  const deleteLog = useCallback(async () => {
    if (!isOwned) return;
    if (!window.confirm(`Delete "${log.title}" forever?`)) return;
    menu.close();
    try {
      await db
        .user(log.authorId)
        .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
        .doc(log.id)
        .delete();
      history.push(Paths.account);
      toast.info('Deleted successfully!');
    } catch (error) {
      toast.error(error.message);
    }
  }, [isOwned, log, history, isTemplate, menu]);

  /** Copy the viewed template, adding it to the user's templates */
  const copyTemplate = useCallback(async () => {
    menu.close();
    if (isOwned || !TrainingLog.isTemplate(log)) return;
    try {
      await db
        .user(user.uid)
        .collection(DbPath.UserTemplates)
        .withConverter(DbConverter.TrainingTemplate)
        .add(log);
      toast.success(`Added ${log.title} to your templates!`);
    } catch (error) {
      toast.error(error.message);
    }
  }, [user.uid, log, isOwned, menu]);

  return (
    <ClickAwayListener onClickAway={menu.close}>
      <div>
        <IconButton
          aria-label="Open log menu"
          aria-controls="log-menu"
          aria-haspopup="true"
          onClick={menu.open}
        >
          <MoreHoriz
            className={css`
              color: ${Color.ActionSecondaryGray};
            `}
            fontSize="small"
          />
        </IconButton>
        <Menu
          id="log-menu"
          anchorEl={menu.ref}
          open={!!menu.ref}
          onClose={menu.close}
          MenuListProps={{ dense: true }}
        >
          {isOwned && window.navigator.share && (
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
          {isTemplate && !isOwned && (
            <MenuItem onClick={copyTemplate}>Add to your Templates</MenuItem>
          )}
          {!isTemplate && isOwned && (
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
