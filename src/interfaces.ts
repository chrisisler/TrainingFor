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

  /** List of users (IDs) this user is following. */
  following: string[];

  /** List of users (IDs) following this user. */
  followers: string[];
}

export interface TrainingLog extends FirestoreDocument {
  title: string;
  timestamp: FirestoreTimestamp;
  notes: null | string;
  authorId: string;
}

export interface Activity extends FirestoreDocument {
  name: string;
  notes: null | string;
  position: number;
  sets: ActivitySet[];
}

export interface ActivitySet {
  uuid: string;
  name: string;
  notes: null | string;
  status: ActivityStatus;
  /** Currently unitless */
  weight: number;
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

// eslint-disable-next-line
export const TrainingLog = {
  /**
   * Attempts to convert the timestamp of a log to a date.
   */
  getDate: (log: TrainingLog): Date | null => {
    if (!log.timestamp) return null;
    return (log.timestamp as firebase.firestore.Timestamp)?.toDate();
  },
};
