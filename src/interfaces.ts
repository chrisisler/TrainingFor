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
  sleepHours: typeof SleepHours[keyof typeof SleepHours] | -99;
}

/** Represents the number of hours of sleep for a TrainingLog. */
export const SleepHours = {
  0: 0,
  0.5: 0.5,
  1: 1,
  1.5: 1.5,
  2: 2,
  2.5: 2.5,
  3: 3,
  3.5: 3.5,
  4: 4,
  4.5: 4.5,
  5: 5,
  5.5: 5.5,
  6: 6,
  6.5: 6.5,
  7: 7,
  7.5: 7.5,
  8: 8,
  8.5: 8.5,
  9: 9,
  9.5: 9.5,
  10: 10,
  10.5: 10.5,
  11: 11,
  11.5: 11.5,
  12: 12,
} as const;

export interface Activity extends FirestoreDocument {
  name: string;
  notes: null | string;
  position: number;
  sets: ActivitySet[];
  weightUnit: ActivityWeightUnit;
  repCountUnit: ActivityRepCountUnit;
  /** A copy of the server timestamp (or null) from the TrainingLog. */
  timestamp: FirestoreTimestamp;
  /** Which TrainingLog was this Activity performed in? */
  logId: string;
  /** Chosen by the user as the best of all of them. */
  isFavorite: boolean;
}

/**
 * A SavedActivity is an Activity belonging to the Library collection. It
 * represents activities commonly executed in training logs and powers a data
 * visualization of the history.
 */
export interface SavedActivity extends FirestoreDocument {
  name: string;
  /**
   * The list of occurrences of an Activity.
   */
  history: { activityId: string; logId: string }[];
}

export interface ActivitySet {
  uuid: string;
  status: ActivitySetStatus;
  weight: number;
  /** A time value or repetition count. */
  repCount: number;
}

export enum ActivitySetStatus {
  // Not yet attempted
  Unattempted = 'unattempted',
  // Attempted and successful
  Completed = 'completed',
  // Attempted
  Injured = 'injured',
  // Will not attempt
  Skipped = 'skipped',
  // Not yet chosen to attempt or skip
  Optional = 'optional',
  // Attempted and unsuccessful
  Missed = 'missed',
}

export enum ActivityRepCountUnit {
  Repetitions = 'rep',
  Seconds = 'sec',
  Minutes = 'min',
  // TODO Clarify. Just 'm' could be miles and probably other units.
  Meters = 'm',
}

export enum ActivityWeightUnit {
  Weightless = '--',
  Kilograms = 'kg',
  Pounds = 'lb',
}

export interface Comment extends FirestoreDocument {
  timestamp: FirestoreTimestamp;
  author: Required<Pick<User, 'id' | 'displayName'>>;
  text: string;
}

const isNotAlpha = /^[^A-Za-z_]+$/;
const whitespaceOrDash = /(\s+|-+)/;

// eslint-disable-next-line
export const SavedActivity = {
  create: (data: Pick<SavedActivity, 'name'>): Omit<SavedActivity, 'id'> => ({
    ...data,
    history: [],
  }),
};

// eslint-disable-next-line
export const Activity = {
  create: (data: Omit<Activity, 'notes' | 'id' | 'isFavorite'>): Omit<Activity, 'id'> => ({
    ...data,
    notes: null,
    isFavorite: false,
  }),
  cycleWeightUnit: (unit: ActivityWeightUnit): ActivityWeightUnit => {
    if (unit === ActivityWeightUnit.Pounds) return ActivityWeightUnit.Kilograms;
    if (unit === ActivityWeightUnit.Kilograms) return ActivityWeightUnit.Weightless;
    if (unit === ActivityWeightUnit.Weightless) return ActivityWeightUnit.Pounds;
    throw Error('Unreachable');
  },
  cycleRepCountUnit: (unit: ActivityRepCountUnit): ActivityRepCountUnit => {
    if (unit === ActivityRepCountUnit.Repetitions) return ActivityRepCountUnit.Seconds;
    if (unit === ActivityRepCountUnit.Seconds) return ActivityRepCountUnit.Minutes;
    if (unit === ActivityRepCountUnit.Minutes) return ActivityRepCountUnit.Meters;
    if (unit === ActivityRepCountUnit.Meters) return ActivityRepCountUnit.Repetitions;
    throw Error('Unreachable');
  },
  /**
   * Calculates the total volume for a given Activity's sets.
   * Volume = [for each rep:] weight * reps
   */
  getVolume: (a: Activity): number => {
    if (a.weightUnit === ActivityWeightUnit.Weightless) {
      return 0;
    }
    if (a.repCountUnit !== ActivityRepCountUnit.Repetitions) {
      // Figure out later
      return 0;
    }
    // weightUnit is LB or KG; repCountUnit is Repetitions
    return a.sets
      .filter(set => set.status === ActivitySetStatus.Completed)
      .reduce((sum, set) => sum + set.weight * set.repCount, 0);
  },
};

const durationRegEx = /\d+\s+\w/;

// eslint-disable-next-line
export const TrainingLog = {
  create: (data: Pick<TrainingLog, 'title' | 'authorId'>): Omit<TrainingLog, 'id'> => ({
    ...data,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    notes: '',
    sleepHours: -99,
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

// eslint-disable-next-line
export const ActivitySet = {
  create: (data: Pick<ActivitySet, 'status' | 'weight' | 'repCount'>): ActivitySet => ({
    ...data,
    uuid: uuid(),
  }),
  cycleStatus: (s: ActivitySetStatus): ActivitySetStatus => {
    if (s === ActivitySetStatus.Unattempted) return ActivitySetStatus.Completed;
    if (s === ActivitySetStatus.Completed) return ActivitySetStatus.Skipped;
    if (s === ActivitySetStatus.Skipped) return ActivitySetStatus.Injured;
    if (s === ActivitySetStatus.Injured) return ActivitySetStatus.Optional;
    if (s === ActivitySetStatus.Optional) return ActivitySetStatus.Missed;
    if (s === ActivitySetStatus.Missed) return ActivitySetStatus.Unattempted;
    throw Error('Unreachable');
  },
  getStatusColor: (s: ActivitySetStatus): string => {
    if (s === ActivitySetStatus.Unattempted) return 'lightgray';
    if (s === ActivitySetStatus.Completed) return 'deepskyblue';
    // Skipped variant color looks like less emphasized version of Completed
    if (s === ActivitySetStatus.Skipped) return 'lightblue';
    if (s === ActivitySetStatus.Injured) return 'red';
    if (s === ActivitySetStatus.Optional) return 'orange';
    if (s === ActivitySetStatus.Missed) return 'purple';
    return 'transparent';
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
  create: (data: Pick<TrainingTemplate, 'authorId' | 'title'>): Omit<TrainingTemplate, 'id'> => ({
    ...data,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    notes: '',
    logIds: [],
    sleepHours: -99,
  }),
};
