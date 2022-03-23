import firebase from 'firebase/app';

import { db, DbConverter, DbPath } from '../firebase';
import { Activity, ActivitySet, ActivitySetStatus, TrainingLog } from '../interfaces';

// TODO
// Re-write all methods as API.Activity.updateSets()
// Export from ActivityAPI.ts
// const Activity_UpdateSets = (log: Pick<TrainingLog, 'id' | 'authorId'>, setData: ActivitySet): Promise<ActivitySet> => {
//
// }

export const cycleStatus = async (
  log: TrainingLog,
  activity: Activity,
  activitySet: ActivitySet
): Promise<ActivitySet> => {
  const foundIndex = activity.sets.findIndex(_ => _.uuid === activitySet.uuid);
  if (!activity.sets[foundIndex]) {
    throw Error('Failed to find via index!');
  }
  const isTemplate = TrainingLog.isTemplate(log);
  // Compute next activity set status from its current status
  const nextStatus = isTemplate
    ? activitySet.status === ActivitySetStatus.Unattempted
      ? ActivitySetStatus.Optional
      : ActivitySetStatus.Unattempted
    : ActivitySet.cycleStatus(activitySet.status);
  const sets = [...activity.sets];

  sets[foundIndex].status = nextStatus;

  try {
    const activityDocument = db
      .user(log.authorId)
      .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
      .doc(log.id)
      .collection(DbPath.UserLogActivities)
      .withConverter(DbConverter.Activity)
      .doc(activity.id);

    await activityDocument.set({ ...activity, sets } as Partial<Activity>, { merge: true });
    console.log('updated!');
    return sets[foundIndex];
  } catch (error) {
    throw error;
  }
};

export const insertNew = async (
  log: TrainingLog,
  activities: Activity[],
  activityIndex: number,
  activitySet: ActivitySet
): Promise<void> => {
  const activity = activities[activityIndex];
  const isTemplate = TrainingLog.isTemplate(log);
  const activityDocument = db
    .user(log.authorId)
    .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
    .doc(log.id)
    .collection(DbPath.UserLogActivities)
    .withConverter(DbConverter.Activity)
    .doc(activity.id);
  try {
    const newSet = ActivitySet.create({ ...activitySet });
    const { sets } = activity;
    // Insert `newSet` item at `index`, deleting 0 items.
    sets.splice(activityIndex + 1, 0, newSet);
    activityDocument.set({ sets } as Partial<Activity>, { merge: true });
  } catch (error) {
    throw error;
  }
};

export const deleteSet = async (
  log: TrainingLog,
  activity: Activity,
  activitySet: ActivitySet
): Promise<void> => {
  const isTemplate = TrainingLog.isTemplate(log);
  const activityDocument = db
    .user(log.authorId)
    .collection(isTemplate ? DbPath.UserTemplates : DbPath.UserLogs)
    .doc(log.id)
    .collection(DbPath.UserLogActivities)
    .withConverter(DbConverter.Activity)
    .doc(activity.id);
  try {
    // Rewrite with .set()
    await activityDocument.update({
      sets: firebase.firestore.FieldValue.arrayRemove(activitySet),
    });
  } catch (error) {
    throw error;
  }
};
