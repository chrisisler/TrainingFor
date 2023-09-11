import { useQuery } from '@tanstack/react-query';
import { getCountFromServer, limit, orderBy, query, where } from 'firebase/firestore';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';

import { API } from '.';
import { useUser } from '../context';
import {
  Movement,
  Program,
  ProgramLogTemplate,
  ProgramUser,
  SavedMovement,
  TrainingLog,
} from '../types';
import { DataState } from '../util';
import { useAPI } from './client';
import { DbPath } from './firebase';

interface Store {
  ProgramLogTemplatesAPI: ReturnType<typeof useAPI<ProgramLogTemplate>>;
  ProgramMovementsAPI: ReturnType<typeof useAPI<Movement>>;
  SavedMovementsAPI: ReturnType<typeof useAPI<SavedMovement>>;
  TrainingLogsAPI: ReturnType<typeof useAPI<TrainingLog>>;
  ProgramUsersAPI: ReturnType<typeof useAPI<ProgramUser>>;
  MovementsAPI: ReturnType<typeof useAPI<Movement>>;
  ProgramsAPI: ReturnType<typeof useAPI<Program>>;
  useMovementsHistory(savedMovementId: string): DataState<Movement[]>;
  useMovements(logId: string, isProgramView?: boolean): DataState<Movement[]>;
  savedMovements: DataState<SavedMovement[]>;
  movementsByLogId: DataState<Map<string, Movement[]>>;
  activeProgram: DataState<Program>;
  programUser: DataState<ProgramUser>;
  templates: DataState<ProgramLogTemplate[]>;
  programs: DataState<Program[]>;
  logs: DataState<TrainingLog[]>;
}

const listeners = new Set();
const subscribe = (listener: (store: Store) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useStore<T>(selector: (store: Store) => T) {
  const ProgramMovementsAPI = useAPI(API.ProgramMovements, DbPath.ProgramMovements);
  const MovementsAPI = useAPI(API.Movements, DbPath.Movements);
  const SavedMovementsAPI = useAPI(API.SavedMovements, DbPath.SavedMovements);
  const TrainingLogsAPI = useAPI(API.TrainingLogs, DbPath.Logs);
  const ProgramsAPI = useAPI(API.Programs, DbPath.Programs);
  const ProgramUsersAPI = useAPI(API.ProgramUsers, DbPath.ProgramUsers);
  const ProgramLogTemplatesAPI = useAPI(API.ProgramLogTemplates, DbPath.ProgramLogTemplates);

  const user = useUser();

  const logs = DataState.from<TrainingLog[]>(
    useQuery({
      queryKey: [DbPath.Logs, user.uid],
      queryFn: () => API.TrainingLogs.getAll(user.uid, orderBy('timestamp', 'desc'), limit(100)),
    })
  );

  const movementsByLogId = DataState.from<Map<string, Movement[]>>(
    useQuery({
      enabled: DataState.isReady(logs),
      queryKey: [DbPath.Movements, logs],
      queryFn: async () => {
        if (!DataState.isReady(logs)) return logs;
        // https://stackoverflow.com/questions/67035919
        const promises = logs.map(_ =>
          API.Movements.getAll(where('logId', '==', _.id), orderBy('position', 'asc'))
        );
        const movementLists: Movement[][] = await Promise.all(promises);
        const map = new Map<string, Movement[]>(logs.map(_ => [_.id, []]));
        movementLists.flat().forEach(movement => map.get(movement.logId)?.push(movement));
        return map;
      },
    })
  );

  const programs = DataState.from<Program[]>(
    useQuery({
      queryKey: [DbPath.Programs, user.uid],
      queryFn: async () => {
        const list = await API.Programs.getAll(user.uid);
        return list.map(p => Program.makeTemplateId(p));
      },
    })
  );

  // `queryKey` is ULTRA important concept or invalidation is insta-broken
  const useMovements = (logId: string, isProgramView = false) =>
    DataState.from<Movement[]>(
      useQuery({
        queryKey: [isProgramView ? DbPath.ProgramMovements : DbPath.Movements, user.uid],
        queryFn: () =>
          (isProgramView ? API.ProgramMovements : API.Movements).getAll(
            where('logId', '==', logId),
            orderBy('position', 'asc')
          ),
      })
    );

  const useMovementsHistory = (savedMovementId: string) =>
    DataState.from<Movement[]>(
      useQuery({
        queryKey: [DbPath.Movements, user.uid],
        queryFn: () =>
          API.Movements.getAll(
            where('savedMovementId', '==', savedMovementId),
            orderBy('timestamp', 'desc')
          ),
      })
    );

  const programUser = DataState.from<ProgramUser>(
    useQuery({
      queryKey: [DbPath.ProgramUsers, user.uid],
      queryFn: async () => {
        const users = await API.ProgramUsers.getAll(where('userUid', '==', user.uid));
        // If there is no entry in ProgramUsers for the current user, create
        // one and use that to keep track of the active program for the user.
        // Programs cannot be unselected.
        if (users.length > 0) {
          // There can ONLY BE ONE!
          if (users.length > 1) {
            users.slice(1).forEach(_ => API.ProgramUsers.delete(_.id));
          }
          return users[0];
        }
        return ProgramUsersAPI.create({
          userUid: user.uid,
          activeProgramId: null,
          activeProgramName: null,
        });
      },
    })
  );

  const savedMovements = DataState.from<SavedMovement[]>(
    useQuery({
      queryKey: [DbPath.SavedMovements, user.uid],
      queryFn: async () => {
        const savedMovements = await API.SavedMovements.getAll(user.uid);
        const countPromises = savedMovements.map(_ =>
          getCountFromServer(query(API.collections.movements, where('savedMovementId', '==', _.id)))
        );
        const counts = (await Promise.all(countPromises)).map(_ => _.data().count);
        // Sort by frequency and recency.
        return savedMovements
          .map((sm, index) => Object.assign(sm, { count: counts[index] }))
          .sort((a, b) => b.count - a.count)
          .sort((a, b) => b.lastSeen - a.lastSeen);
      },
    })
  );

  const activeProgram = DataState.from<Program>(
    useQuery({
      enabled: DataState.isReady(programUser),
      queryKey: [DbPath.Programs, user.uid, programUser],
      queryFn: async () => {
        if (!DataState.isReady(programUser)) return Promise.reject('programUser not ready.');
        if (!programUser.activeProgramId) throw TypeError('activeProgramId not found');
        return API.Programs.get(programUser.activeProgramId).then(p => Program.makeTemplateId(p));
      },
    })
  );

  const templates = DataState.from<ProgramLogTemplate[]>(
    useQuery({
      enabled: DataState.isReady(activeProgram),
      queryKey: [DbPath.ProgramLogTemplates, user.uid, activeProgram],
      queryFn: () => {
        if (!DataState.isReady(activeProgram)) return Promise.reject('activeProgram not ready.');
        return API.ProgramLogTemplates.getAll(
          user.uid,
          where('id', 'in', activeProgram.templateIds)
        );
      },
    })
  );
  // Duplicate way to get the same data
  // const templates = DataState.from<ProgramLogTemplate[]>(
  //   useQuery({
  //     enabled: DataState.isReady(programUser),
  //     queryKey: [DbPath.ProgramLogTemplates, user.uid],
  //     queryFn: () => {
  //       if (!DataState.isReady(programUser)) return Promise.reject('programUser not ready.');
  //       return API.ProgramLogTemplates.getAll(
  //         user.uid,
  //         where('programId', '==', programUser.activeProgramId)
  //       );
  //     },
  //   })
  // );

  // TODO
  // - [ ] newTemplateId usage of useDataState
  const store = {
    ProgramsAPI,
    ProgramMovementsAPI,
    SavedMovementsAPI,
    TrainingLogsAPI: {
      ...TrainingLogsAPI,
      async delete(logId: string) {
        await Promise.all([
          TrainingLogsAPI.delete(logId),
          MovementsAPI.deleteMany(where('logId', '==', logId)),
        ]);
      },
    },
    MovementsAPI,
    ProgramUsersAPI,
    ProgramLogTemplatesAPI,
    useMovements,
    useMovementsHistory,
    logs,
    savedMovements,
    movementsByLogId,
    templates,
    activeProgram,
    programUser,
    programs,
  };

  // Apply selector and memoize result
  return useSyncExternalStoreWithSelector(subscribe, () => store, null, selector);
}
