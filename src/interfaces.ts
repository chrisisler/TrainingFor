import { formatDuration, intervalToDuration } from 'date-fns';
import firebase from 'firebase';
import { v4 as uuid } from 'uuid';

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
  notes: string;
  authorId: string;
}

export interface Activity extends FirestoreDocument {
  name: string;
  notes: null | string;
  position: number;
  sets: ActivitySet[];
  attachmentUrl: null | string;
  weightUnit: ActivityWeightUnit;
  repCountUnit: ActivityRepCountUnit;
}

export interface ActivitySet {
  uuid: string;
  notes: null | string;
  status: ActivityStatus;
  weight: number;
  /** repCount represents either a time value or repetition count */
  repCount: null | number;
  side: ActivitySetSide;
}

export enum ActivityStatus {
  Unattempted = 'unattempted',
  Completed = 'completed',
  Injured = 'injured',
  Skipped = 'skipped',
}

export enum ActivityRepCountUnit {
  Repetitions = 'rep',
  Seconds = 'sec',
  Minutes = 'min',
}

export enum ActivityWeightUnit {
  Weightless = '--',
  Kilograms = 'kg',
  Pounds = 'lb',
}

export enum ActivitySetSide {
  Both = 'LR',
  Left = 'L',
  Right = 'R',
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
  create: (
    data: Pick<Activity, 'name' | 'position'>
  ): Omit<Activity, 'id'> => ({
    name: data.name,
    position: data.position,
    notes: null,
    sets: [],
    attachmentUrl: null,
    repCountUnit: ActivityRepCountUnit.Repetitions,
    weightUnit: ActivityWeightUnit.Pounds, // 'MURRICA!!
  }),
  cycleWeightUnit: (unit: ActivityWeightUnit): ActivityWeightUnit => {
    if (unit === ActivityWeightUnit.Pounds) return ActivityWeightUnit.Kilograms;
    if (unit === ActivityWeightUnit.Kilograms)
      return ActivityWeightUnit.Weightless;
    if (unit === ActivityWeightUnit.Weightless)
      return ActivityWeightUnit.Pounds;
    throw Error('Unreachable');
  },
  cycleRepCountUnit: (unit: ActivityRepCountUnit): ActivityRepCountUnit => {
    if (unit === ActivityRepCountUnit.Repetitions)
      return ActivityRepCountUnit.Seconds;
    if (unit === ActivityRepCountUnit.Seconds)
      return ActivityRepCountUnit.Minutes;
    if (unit === ActivityRepCountUnit.Minutes)
      return ActivityRepCountUnit.Repetitions;
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
  create: (
    data: Pick<TrainingLog, 'title' | 'authorId'>
  ): Omit<TrainingLog, 'id'> => ({
    title: data.title,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    notes: '',
    authorId: data.authorId,
  }),
  getDate: (log: TrainingLog): Date | null => {
    if (!log?.timestamp) return null;
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

// eslint-disable-next-line
export const ActivitySet = {
  create: (
    data: Pick<ActivitySet, 'status' | 'weight' | 'repCount'>
  ): ActivitySet => ({
    ...data,
    uuid: uuid(),
    notes: null,
    side: ActivitySetSide.Both,
  }),
  cycleSide: (s: ActivitySetSide): ActivitySetSide => {
    if (s === ActivitySetSide.Both) return ActivitySetSide.Left;
    if (s === ActivitySetSide.Left) return ActivitySetSide.Right;
    if (s === ActivitySetSide.Right) return ActivitySetSide.Both;
    return s;
  },
  cycleStatus: (s: ActivityStatus): ActivityStatus => {
    if (s === ActivityStatus.Unattempted) return ActivityStatus.Completed;
    if (s === ActivityStatus.Completed) return ActivityStatus.Skipped;
    if (s === ActivityStatus.Skipped) return ActivityStatus.Injured;
    if (s === ActivityStatus.Injured) return ActivityStatus.Unattempted;
    throw Error('Unreachable');
  },
  getStatusColor: (s: ActivityStatus): string => {
    if (s === ActivityStatus.Unattempted) return 'lightgray';
    if (s === ActivityStatus.Completed) return 'deepskyblue';
    // Skipped variant color looks like less emphasized version of Completed
    if (s === ActivityStatus.Skipped) return 'lightblue';
    if (s === ActivityStatus.Injured) return 'red';
    throw Error('Unreachable');
  },
};

// eslint-disable-next-line
export const Comment = {
  create: (data: Pick<Comment, 'author' | 'text'>): Omit<Comment, 'id'> => ({
    ...data,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  }),
};

// eslint-disable-next-line
export const TrainingTemplate = {
  create: (
    data: Pick<TrainingTemplate, 'authorId' | 'title'>
  ): Omit<TrainingTemplate, 'id'> => ({
    title: data.title,
    authorId: data.authorId,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    notes: '',
    logIds: [],
  }),
};
