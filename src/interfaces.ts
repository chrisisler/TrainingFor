import { formatDuration, intervalToDuration } from 'date-fns';
import firebase from 'firebase';

interface FirestoreDocument {
  id: string;
}

/**
 * The _actual_ return value of
 * `firebase.firestore.FieldValue.serverTimestamp()` due to timestamps being
 * null before they are calculated on the server.
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

export interface TrainingTemplate extends TrainingLog {
  /** IDs of TrainingLogs stamped out from this template. */
  logIds: string[];
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
const whitespaceOrDash = /(\s+|-+)/;

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
      .split(whitespaceOrDash)
      .flatMap(word => {
        // Skip tokens that are not words
        if (isNotAlpha.test(word[0])) return [];
        return [word[0]];
      })
      .join('');
  },
};

const durationRegEx = /\d+\s+\w/;

// eslint-disable-next-line
export const TrainingLog = {
  getDate: (log: TrainingLog): Date | null => {
    if (!log.timestamp) return null;
    return (log.timestamp as firebase.firestore.Timestamp)?.toDate();
  },
  /**
   * Given a TrainingLog (or any Firestore timestamped resource) compute it's
   * days relative to now.
   */
  getDistance: (logTimestamp: FirestoreTimestamp): string => {
    if (!logTimestamp) return '';
    const logDate = (logTimestamp as firebase.firestore.Timestamp)?.toDate();
    const duration = intervalToDuration({ start: logDate, end: new Date() });
    // `distance` is a string like "27 days 42 seconds"
    const distance = formatDuration(duration);
    // Select the first number, space, and first letter of the token, "27 d"
    return durationRegEx.exec(distance)?.[0].replace(' ', '') ?? '';
  },
  isTemplate: (log: TrainingLog | TrainingTemplate): log is TrainingTemplate =>
    Object.prototype.hasOwnProperty.call(log, 'logIds'),
};
