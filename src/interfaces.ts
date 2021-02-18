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
  following: string[];
  followers: string[];
}

// type Feeling = 'sad' | 'amazed';

export interface TrainingLog extends FirestoreDocument {
  title: string;
  timestamp: FirestoreTimestamp;
  notes: null | string;
  authorId: string;
  /** The way the trainee felt going into training. */
  // feeling: Feeling;
}

export interface Activity extends FirestoreDocument {
  name: string;
  notes: null | string;
  position: number;
  sets: ActivitySet[];
  attachmentUrl: null | string;
}

export interface ActivitySet {
  uuid: string;
  name: string;
  notes: null | string;
  status: ActivityStatus;
  weight: number;
  repCount: null | number;
}

export enum ActivityStatus {
  Unattempted = 'unattempted',
  Completed = 'completed',
  Injured = 'injured',
  Skipped = 'skipped',
}

export interface Comment extends FirestoreDocument {
  timestamp: FirestoreTimestamp;
  author: Required<Pick<User, 'id' | 'displayName'>>;
  text: string;
}

const isNotAlpha = /^[^A-Za-z_]+$/;
const isAllCaps = /^[A-Z0-9]+$/;

// eslint-disable-next-line
export const Activity = {
  cycleStatus: (s: ActivityStatus): ActivityStatus => {
    if (s === ActivityStatus.Unattempted) return ActivityStatus.Completed;
    if (s === ActivityStatus.Completed) return ActivityStatus.Skipped;
    if (s === ActivityStatus.Skipped) return ActivityStatus.Injured;
    if (s === ActivityStatus.Injured) return ActivityStatus.Unattempted;
    throw Error('Unreachable');
  },
  abbreviate: (name: string): string => {
    return name
      .split(' ')
      .flatMap(word => {
        if (isNotAlpha.test(word[0])) return [];
        if (isAllCaps.test(word)) return [word];
        return [word[0]];
      })
      .join('');
  },
};

// eslint-disable-next-line
export const TrainingLog = {
  getDate: (log: TrainingLog): Date | null => {
    if (!log.timestamp) return null;
    return (log.timestamp as firebase.firestore.Timestamp)?.toDate();
  },
};
