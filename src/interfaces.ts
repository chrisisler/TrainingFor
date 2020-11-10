import firebase from 'firebase';

interface FirestoreDocument {
  id: string;
}

export interface User extends FirestoreDocument {
  displayName: string;
  /** A Firebase collection. */
  logs: TrainingLog[];
}

export interface TrainingLog extends FirestoreDocument {
  timestamp: null | firebase.firestore.FieldValue;
  notes: null | string;
  activities: Activity[];
}

export interface Activity extends FirestoreDocument {
  name: string;
  notes: null | string;
  timestamp: null | firebase.firestore.FieldValue;
  sets: ActivitySet[];
}

export interface ActivitySet {
  name: string;
  repCount: null | number;
  notes: null | string;
  status: ActivityStatus;
}

export enum ActivityStatus {
  Unattempted = 'unattempted',
  Completed = 'completed',
  Injured = 'injured',
}

// eslint-disable-next-line
export const Activity = {
  cycleStatus: (s: ActivityStatus): ActivityStatus => {
    if (s === ActivityStatus.Unattempted) return ActivityStatus.Completed;
    if (s === ActivityStatus.Completed) return ActivityStatus.Injured;
    if (s === ActivityStatus.Injured) return ActivityStatus.Unattempted;
    throw Error('Unreachable');
  },
};
