import firebase from 'firebase';

interface FirestoreDocument {
  id: string;
}

/**
 * The _actual_ return value of
 * `firebase.firestore.FieldValue.serverTimestamp()`.
 *
 * Sometimes Firestore timestamps are null before they exist.
 */
type FirestoreTimestamp = null | firebase.firestore.FieldValue;

export interface User extends FirestoreDocument {
  creationTime: FirestoreTimestamp;
  displayName: string;
}

export interface TrainingLog extends FirestoreDocument {
  title: string;
  timestamp: FirestoreTimestamp;
  notes: null | string;
}

export interface Activity extends FirestoreDocument {
  name: string;
  notes: null | string;
  // TODO Deprecate
  timestamp: FirestoreTimestamp;
  /** The index of the Activity. */
  position: number;
  sets: ActivitySet[];
}

export interface ActivitySet {
  /** ID generated from uuid.v4() */
  uuid: string;
  name: string;
  notes: null | string;
  status: ActivityStatus;
  /** Currently unitless */
  weight: number;
  // repCount: null | number;
  /**
   * Rate of Perceived Exertion.
   * 10: Absolute maximum
   * 9.5: Only one rep possible, but weight could be increased.
   * 9: One more rep could be performed.
   * 8.5: One or two more reps possible.
   */
  // rpe: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 8.5 | 9 | 9.5 | 10;
}

export enum ActivityStatus {
  Unattempted = 'unattempted',
  Completed = 'completed',
  Injured = 'injured',
  Skipped = 'skipped',
}

// eslint-disable-next-line
export const Activity = {
  cycleStatus: (s: ActivityStatus): ActivityStatus => {
    if (s === ActivityStatus.Unattempted) return ActivityStatus.Completed;
    if (s === ActivityStatus.Completed) return ActivityStatus.Skipped;
    if (s === ActivityStatus.Skipped) return ActivityStatus.Injured;
    if (s === ActivityStatus.Injured) return ActivityStatus.Unattempted;
    throw Error('Unreachable');
  },
};
