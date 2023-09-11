import {
  collection,
  FirestoreDataConverter,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import {
  TrainingLog,
  Movement,
  SavedMovement,
  ProgramLogTemplate,
  ProgramUser,
  Program,
} from '../types';
import { createAPI } from './client';
import { db, DbPath } from './firebase';

export * from './firebase';
export * from './client';
export * from './store';

export const API = init();

function init() {
  const trainingLogsRef = collection(db, DbPath.Logs).withConverter(converter<TrainingLog>());
  const savedMovementsRef = collection(db, DbPath.SavedMovements).withConverter(
    converter<SavedMovement>()
  );
  const movementsRef = collection(db, DbPath.Movements).withConverter(converter<Movement>());
  const programLogTemplatesRef = collection(db, DbPath.ProgramLogTemplates).withConverter(
    converter<ProgramLogTemplate>()
  );
  const programUsersRef = collection(db, DbPath.ProgramUsers).withConverter(
    converter<ProgramUser>()
  );
  const programsRef = collection(db, DbPath.Programs).withConverter(converter<Program>());
  const programMovementsRef = collection(db, DbPath.ProgramMovements).withConverter(
    converter<Movement>()
  );

  const TrainingLogs = createAPI(trainingLogsRef);
  const SavedMovements = createAPI(savedMovementsRef);
  const Movements = createAPI(movementsRef);
  const ProgramLogTemplates = createAPI(programLogTemplatesRef);
  const ProgramUsers = createAPI(programUsersRef);
  const Programs = createAPI(programsRef);
  const ProgramMovements = createAPI(programMovementsRef);

  return {
    TrainingLogs: {
      ...TrainingLogs,
      async delete(logId: string) {
        await Promise.all([
          TrainingLogs.delete(logId),
          Movements.deleteMany(where('logId', '==', logId)),
        ]);
        return;
      },
    },
    SavedMovements,
    Movements,
    ProgramLogTemplates,
    ProgramUsers,
    Programs,
    ProgramMovements,

    collections: {
      movements: movementsRef,
      savedMovements: savedMovementsRef,
      logs: trainingLogsRef,
      programLogTemplates: programLogTemplatesRef,
      programUsers: programUsersRef,
      programs: programsRef,
      programMovements: programMovementsRef,
    },

    assignAnonymousDataToGoogleUser,
  };
}

function converter<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore: data => data,
    // @ts-ignore
    fromFirestore: doc => Object.assign(doc.data(), { id: doc.id }),
  };
}

/**
 * "Copies" the data from the anonymous user account into the Google user
 * account by reassigning all data from that old user to the new user's ID as
 * the data author.
 */
async function assignAnonymousDataToGoogleUser(oldUserId: string, newUserId: string) {
  const q = where('authorUserId', '==', oldUserId);
  // Get all IDs of the old user's documents
  const snapshots = await Promise.all([
    getDocs(query(API.collections.logs, q)),
    getDocs(query(API.collections.movements, q)),
    getDocs(query(API.collections.savedMovements, q)),
  ]);
  const batch = writeBatch(db);
  snapshots.forEach(({ docs }) => {
    docs.forEach((doc: (typeof docs)[0]) => {
      // Assign the data from the old user to the new user
      batch.update<ReturnType<typeof doc.data>>(doc.ref, { authorUserId: newUserId });
    });
  });
  await batch.commit();
}
