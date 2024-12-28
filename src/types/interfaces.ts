import { DataState, dateDisplay, SORTED_WEEKDAYS } from '../util';

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
  timestamp?: number;
  note: string;
  /** List of program log templates for this program. */
  templateIds: string[];
}

export interface ProgramLogTemplate extends FirestoreDocument {
  programId: string;
  authorUserId: string;
  name: string;
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
  /**
   * Flag for whether the entry is formally finished.
   */
  isFinished: boolean;
}

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
  note: string;
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

export const abbreviate = (unit: MovementRepCountUnit): string => {
  if (unit === MovementRepCountUnit.Reps) return 'Reps';
  if (unit === MovementRepCountUnit.Seconds) return 'Secs';
  if (unit === MovementRepCountUnit.Minutes) return 'Mins';
  if (unit === MovementRepCountUnit.Meters) return 'Meters';
  throw new Error(`Unknown unit: ${unit}`);
};

export enum MovementWeightUnit {
  Kilograms = 'Kg',
  Pounds = 'Lb',
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TrainingLog = {
  title(log: DataState<TrainingLog>) {
    if (DataState.isReady(log)) {
      return dateDisplay(new Date(log.timestamp));
    }

    return '';
  },
};

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const MovementSet = {
  /**
   * Compute volume of a given list of sets.
   */
  summate(sets: MovementSet[]): number {
    // Sums up the weight if there is weight or just reps if no weight is found.
    const reducer =
      sets?.[0]?.weight === 0
        ? (sum: number, _: MovementSet) => sum + _.repCountActual
        : (sum: number, _: MovementSet) => sum + _.repCountActual * _.weight;
    return sets.reduce(reducer, 0);
  },
};

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Program = {
  makeTemplateId(p: Program): Program {
    // If data is in old pre-migration format, update it to use templateIds
    if ('daysOfWeek' in p && !!p.daysOfWeek && typeof p.daysOfWeek === 'object') {
      // @ts-ignore
      p.templateIds = SORTED_WEEKDAYS.flatMap(w => p.daysOfWeek[w.toLowerCase()] ?? []);
    }
    return p;
  },
};
