import { DataState, SORTED_WEEKDAYS, Weekdays } from '../util';

export interface FirestoreDocument {
  id: string;
}

// Saves the user's current program
export interface ProgramUser extends FirestoreDocument {
  userUid: string;
  activeProgramId: string | null;
  activeProgramName: string | null;
}

export interface Program extends FirestoreDocument {
  name: string;
  authorUserId: string;
  readonly daysOfWeek: Record<Lowercase<Weekdays>, null | ProgramLogTemplate['id']>;
  timestamp: number;
}

export interface ProgramLogTemplate extends FirestoreDocument {
  programId: string;
  authorUserId: string;
}

export interface TrainingLog extends FirestoreDocument {
  timestamp: number;
  authorUserId: string;
  /**
   * Currently unitless.
   */
  bodyweight: number;
  /**
   * If this training session is generated from a program, this is the program
   * ID and template ID for making training logs like this one.
   */
  programId: string | null;
  programLogTemplateId: string | null;
  note: string;
}

/**
 * Log for sleep, walks, water, food intake, mood, thoughts (usually about training)
 *
 * Upon completion of the RestLog, the user will get points.
 */
// export interface RestLog extends FirestoreDocument {
//   timestamp: number;
//   authorUserId: string;
//   // checkboxes
//   /** The self-reported sufficient sleep quality. */
//   userWokeUpWellRested: boolean;
//   // mood: { NotSure: boolean; Bad: boolean; Neutral: boolean; Good: boolean };
// }

/**
 * Represents the list of all occurrences of a performed Movement.
 * For example, all bench press `Movement` instances are tied to a single bench
 * press `SavedMovement`.
 * This is so that variations on the separate movements can be named different
 * things (close grip, swiss bar, etc)
 */
// `SavedMovement`s do *not* need {weight,repCount}Unit fields because
// Movements are always stamped out from existing Movements with this
// savedMovementId.
export interface SavedMovement extends FirestoreDocument {
  name: string;
  authorUserId: string;
  /** The timestamp this SaveMovement was *last* put into a log (may have been deleted). */
  lastSeen: number;
}

/**
 * A single instance of a performed movement.
 *
 * For example, there may be 37 "yoga" Movements - while there is only 1
 * "yoga" SavedMovement.
 */
export interface Movement extends FirestoreDocument {
  name: string;
  timestamp: number;
  /** The ID of the user who made the movement. */
  authorUserId: string;
  /** The ID of the TrainingLog OR ProgramLogTemplate this Movement belongs to. */
  logId: string;
  /** The ID of the parent/entry representing all instances of this movement. */
  savedMovementId: string;
  /** The name of the SavedMovement this Movement belongs to. */
  savedMovementName: string;
  position: number;
  weightUnit: MovementWeightUnit;
  repCountUnit: MovementRepCountUnit;
  isFavorited: boolean;
  sets: MovementSet[];
  // queues: string[]; // Does this belong on SavedMovement instead?
}

/**
 * *Not* Set of Movement instances, but a section of engaging in the Movement.
 */
export interface MovementSet {
  uuid: string;
  status: MovementSetStatus;
  weight: number;
  /** Number of reps satisfactorily executed. */
  repCountActual: number;
  /** Minimum number of reps expected to achieve. */
  repCountExpected: number;
  /** Maximum number of reps expected to achieve. */
  repCountMaxExpected: number;
}

export enum MovementSetStatus {
  /** Not yet attempted */
  Unattempted = 'unattempted',
  /** Attempted and successful */
  Completed = 'completed',
  /** Not yet chosen to attempt or skip */
  // Optional = 'optional',
}

export enum MovementRepCountUnit {
  Reps = 'Reps',
  Seconds = 'Seconds',
  Minutes = 'Minutes',
  Meters = 'Meters',
}

export enum MovementWeightUnit {
  Kilograms = 'Kg',
  Pounds = 'Lb',
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Program = {
  /**
   * Given a Program, return the ProgramLogTemplate ID from the program
   * daysOfWeek field for the next upcoming weekday. If today is wednesday and
   * the program has training on Tue, Thu, and Sat, then the
   * programLogTemplateId for Thu is returned.
   */
  getNextTraining(program: DataState<Program>): { templateId: string; text: string } | null {
    if (!DataState.isReady(program)) {
      return null;
    }
    const today = SORTED_WEEKDAYS[new Date().getDay()];
    // From today til end of week
    const remainingWeekdays = SORTED_WEEKDAYS.slice(SORTED_WEEKDAYS.indexOf(today));
    for (const _remainingWeekday of remainingWeekdays) {
      const remainingWeekday = _remainingWeekday.toLowerCase();
      const templateId = program.daysOfWeek[remainingWeekday];
      if (templateId) {
        const days = Object.keys(program.daysOfWeek);
        const dayIndex = days
          .filter(d => program.daysOfWeek[d])
          .slice(0, days.indexOf(remainingWeekday) + 1).length;
        const text = `${program.name}, ${_remainingWeekday}, Day ${dayIndex}`;
        return { templateId, text };
      }
    }
    return null;
  },
};
