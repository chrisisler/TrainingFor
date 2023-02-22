interface FirestoreDocument {
  id: string;
}

export interface TrainingLog extends FirestoreDocument {
  timestamp: number;
  authorUserId: string;

  // notes: string;

  /** 
   * A checkmark warmup list the user creates for themself. Makes it easy to
   * knock things off to get into the good stuff. 
   *
   */
  // TODO Create Warmup tab like Stronglifts 5x5
  // warmup: { description: string; done: boolean }[];
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
  /** The ID of the TrainingLog this Movement belongs to. */
  logId: string;
  /** A reference to the ID of the entity representing all instances of this movement. */
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
  /** The number of reps actually achieved in this set. */
  repCountActual: number;
  /** The number of reps expected to achieve in this set. */
  repCountExpected: number;
}

export enum MovementSetStatus {
  /** Not yet attempted */
  Unattempted = 'unattempted',
  /** Attempted and successful */
  Completed = 'completed',
  /** Attempted */
  // Injured = 'injured',
  /** Will not attempt */
  // Skipped = 'skipped',
  /** Not yet chosen to attempt or skip */
  Optional = 'optional',
  /** Attempted and unsuccessful */
  // Missed = 'missed',
}

export enum MovementRepCountUnit {
  Reps = 'Reps',
  Seconds = 'Seconds',
  Minutes = 'Minutes',
  Meters = 'Meters',
}

export enum MovementWeightUnit {
  /** Bodyweight */
  Weightless = 'BW',
  Kilograms = 'Kg',
  Pounds = 'Lb',
}
