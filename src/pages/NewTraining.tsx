import { css } from '@emotion/css';
import { Button, FormControl, InputLabel, NativeSelect } from '@material-ui/core';
import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import firebase from 'firebase/app';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { toast } from 'react-toastify';

import { Paths, Weekdays } from '../constants';
import { DataState, DataStateView, useDataState } from '../DataState';
import { db, DbConverter, DbPath } from '../firebase';
import { useUser } from '../hooks';
import { TrainingLog, TrainingTemplate } from '../interfaces';
import { Columns, Pad } from '../style';

export const NewTraining: FC = () => {
  const [templateId, setTemplateId] = useState('');

  const user = useUser();
  const history = useHistory();

  const [prevLog] = useDataState(
    () =>
      db
        .user(user.uid)
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

  // Map of template id's to the template data for each template
  const [templates] = useDataState<Map<string, TrainingTemplate>>(
    () =>
      db
        .user(user.uid)
        .collection(DbPath.UserTemplates)
        .withConverter(DbConverter.TrainingTemplate)
        .get()
        .then(({ docs }) => new Map(docs.map(doc => [doc.id, doc.data()]))),
    [user.uid]
  );

  const selectedTemplate: DataState<TrainingTemplate> = useMemo(
    () => DataState.map(templates, map => map.get(templateId) ?? DataState.Empty),
    [templates, templateId]
  );

  const createTrainingLog = useCallback(async () => {
    const templateTitle = DataState.isReady(selectedTemplate) ? selectedTemplate.title : '';
    const title = `${Weekdays[new Date().getDay()]} ${templateTitle || 'Training'}`;
    const newLog = TrainingLog.create({
      title,
      authorId: user.uid,
    });
    try {
      const newLogRef = await db.user(user.uid).collection(DbPath.UserLogs).add(newLog);
      // Copy the activites to the new training log if using a template
      if (DataState.isReady(selectedTemplate)) {
        const logActivities = newLogRef.collection(DbPath.UserLogActivities);
        const batch = db.batch();
        const templateActivitiesSnapshot = await db
          .user(user.uid)
          .collection(DbPath.UserTemplates)
          .doc(selectedTemplate.id)
          .collection(DbPath.UserTemplateActivities)
          .withConverter(DbConverter.Activity)
          .get();
        // Create new Activity documents with the same data from the
        // Template but each their own custom ID
        templateActivitiesSnapshot.docs.forEach(templateActivityDoc => {
          const templateActivity = templateActivityDoc.data();
          const newLogActivityRef = logActivities.doc();
          const newLogActivityComments = newLogActivityRef
            .collection(DbPath.UserLogActivityComments)
            .withConverter(DbConverter.Comment);
          // Asynchronously copy comments from templateActivity to logActivity
          templateActivityDoc.ref
            .collection(DbPath.UserLogActivityComments)
            .withConverter(DbConverter.Comment)
            .get()
            .then(({ empty, docs }) => {
              if (empty) return; // No comments to copy over
              docs.forEach(commentDoc => {
                newLogActivityComments.add(commentDoc.data()).catch(error => {
                  toast.error(error.message);
                });
              });
            })
            .catch(error => {
              toast.error(error.message);
            });
          batch.set(newLogActivityRef, templateActivity);
        });
        await batch.commit();
        // Add this log to the list of logs created from the selected template
        await db
          .user(user.uid)
          .collection(DbPath.UserTemplates)
          .doc(selectedTemplate.id)
          .update({
            logIds: firebase.firestore.FieldValue.arrayUnion(newLogRef.id),
          });
      }
      history.push(Paths.logEditor(newLogRef.id));
    } catch (error) {
      toast.error(error.message);
    }
  }, [history, user.uid, selectedTemplate]);

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
        pad={Pad.Medium}
        className={css`
          text-align: center;
        `}
        maxWidth
      >
        <FormControl disabled={!DataState.isReady(templates)}>
          <InputLabel htmlFor="template-helper">Training Templates</InputLabel>
          <NativeSelect
            value={templateId}
            onChange={event => setTemplateId(event.target.value)}
            inputProps={{
              name: 'Training Template',
              id: 'template-helper',
            }}
          >
            <option aria-label="None" value="" />
            <DataStateView data={templates} error={() => null} loading={() => null}>
              {templates =>
                templates.size ? (
                  <>
                    {Array.from(templates.values()).map(template => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </>
                ) : (
                  <option aria-label="None" value="">
                    No templates!
                  </option>
                )
              }
            </DataStateView>
          </NativeSelect>
        </FormControl>
        <Button variant="contained" color="primary" onClick={createTrainingLog} size="large">
          New Training
        </Button>
        <Button
          disabled={!DataState.isReady(prevLogDate)}
          variant="outlined"
          color="primary"
          onClick={() => {
            if (!DataState.isReady(prevLog)) return;
            history.push(Paths.logEditor(prevLog.id));
          }}
          size="small"
        >
          <DataStateView
            data={prevLogDate}
            error={() => null}
            loading={() => <>Loading last training...</>}
            empty={() => <>No previous training</>}
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
