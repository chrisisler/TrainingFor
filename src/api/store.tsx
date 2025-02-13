import { useQuery } from '@tanstack/react-query';
import { getCountFromServer, limit, orderBy, query, where } from 'firebase/firestore';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';

import { API } from '.';
import {
  Movement,
  Program,
  ProgramLogTemplate,
  ProgramUser,
  SavedMovement,
  TrainingLog,
} from '../types';
import { DataState, useUser } from '../util';
import { useAPI } from './client';
import { DbPath } from './firebase';

interface Store {
  // Actions/Messages/Events
  ProgramLogTemplatesAPI: ReturnType<typeof useAPI<ProgramLogTemplate>>;
  ProgramMovementsAPI: ReturnType<typeof useAPI<Movement>>;
  SavedMovementsAPI: ReturnType<typeof useAPI<SavedMovement>>;
  TrainingLogsAPI: ReturnType<typeof useAPI<TrainingLog>>;
  ProgramUsersAPI: ReturnType<typeof useAPI<ProgramUser>>;
  MovementsAPI: ReturnType<typeof useAPI<Movement>>;
  ProgramsAPI: ReturnType<typeof useAPI<Program>>;
  // Fetch data
  useMovementsHistory(savedMovementId: string): DataState<Movement[]>;
  useMovements(logId: string, isProgramView?: boolean): DataState<Movement[]>;
  useTrainingLogsCount(userUid: string): DataState<number>;
  useProgramMovementsByTemplateId(programId?: string): DataState<Map<string, Movement[]>>;
  // State/Model/Data
  // programMovementsByTemplateId: DataState<Map<string, Movement[]>>;
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
  const user = useUser();

  const ProgramMovementsAPI = useAPI(API.ProgramMovements, [DbPath.ProgramMovements]);
  const MovementsAPI = useAPI(API.Movements, [DbPath.Movements]);
  const SavedMovementsAPI = useAPI(API.SavedMovements, [DbPath.SavedMovements]);
  const TrainingLogsAPI = useAPI(API.TrainingLogs, [DbPath.Logs]);
  const ProgramsAPI = useAPI(API.Programs, [DbPath.Programs]);
  const ProgramUsersAPI = useAPI(API.ProgramUsers, [DbPath.ProgramUsers]);
  const ProgramLogTemplatesAPI = useAPI(API.ProgramLogTemplates, [DbPath.ProgramLogTemplates]);

  const logs = DataState.from<TrainingLog[]>(
    useQuery(TrainingLogsAPI.queryKey, () =>
      API.TrainingLogs.getAll(user.uid, orderBy('timestamp', 'desc'), limit(30))
    )
  );

  const movementsByLogId = DataState.from<Map<string, Movement[]>>(
    useQuery(
      MovementsAPI.queryKey,
      async () => {
        if (!DataState.isReady(logs)) return Promise.reject('Logs not ready for movementsByLogId');
        // https://stackoverflow.com/questions/67035919
        const promises = logs.map(_ =>
          API.Movements.getAll(where('logId', '==', _.id), orderBy('position', 'asc'))
        );
        const movementLists: Movement[][] = await Promise.all(promises);
        return new Map(logs.map((_, index) => [_.id, movementLists[index]]));
      },
      { enabled: DataState.isReady(logs) }
    )
  );

  const programs = DataState.from<Program[]>(
    useQuery(ProgramsAPI.queryKey, () =>
      API.Programs.getAll(user.uid).then(list => list.map(p => Program.makeTemplateId(p)))
    )
  );

  const useMovements = (logId: string, isProgramView = false) =>
    DataState.from<Movement[]>(
      useQuery([isProgramView ? DbPath.ProgramMovements : DbPath.Movements, { logId }], () =>
        (isProgramView ? API.ProgramMovements : API.Movements).getAll(
          where('logId', '==', logId),
          orderBy('position', 'asc')
        )
      )
    );

  const useMovementsHistory = (savedMovementId: string) =>
    DataState.from<Movement[]>(
      useQuery(MovementsAPI.queryKey.concat({ savedMovementId }), () =>
        API.Movements.getAll(
          where('savedMovementId', '==', savedMovementId),
          orderBy('timestamp', 'desc')
        )
      )
    );

  const programUser = DataState.from<ProgramUser>(
    useQuery(ProgramUsersAPI.queryKey, async () => {
      const users = await API.ProgramUsers.getAll(where('userUid', '==', user.uid));
      // If there is no entry in ProgramUsers for the current user, create
      // one and use that to keep track of the active program for the user.
      // Programs cannot be unselected.
      if (users.length > 0) {
        // There can ONLY BE ONE!
        if (users.length > 1) users.slice(1).forEach(_ => ProgramUsersAPI.delete(_.id));
        return users[0];
      }
      return ProgramUsersAPI.create({
        userUid: user.uid,
        activeProgramId: null,
        activeProgramName: null,
      });
    })
  );

  const useTrainingLogsCount = (userUid: string) =>
    DataState.from<number>(
      useQuery(TrainingLogsAPI.queryKey.concat({ userUid }), async () => {
        const snapshot = await getCountFromServer(
          query(API.collections.logs, where('authorUserId', '==', userUid))
        );
        return snapshot.data().count;
      })
    );

  const savedMovements = DataState.from<SavedMovement[]>(
    useQuery(SavedMovementsAPI.queryKey, async () => {
      // XXX There has to be a better way to do this
      const savedMovements = await API.SavedMovements.getAll(user.uid);
      const countPromises = savedMovements.map(_ =>
        getCountFromServer(query(API.collections.movements, where('savedMovementId', '==', _.id)))
      );
      // const countPromises = getCountFromServer(
      //   query(API.collections.savedMovements, where('authorUserId', '==', user.uid))
      // );
      const counts = (await Promise.all(countPromises)).map(_ => _.data().count);
      // Sort by frequency and recency.
      return savedMovements
        .map((sm, index) => Object.assign(sm, { count: counts[index] }))
        .sort((a, b) => b.count - a.count)
        .sort((a, b) => b.lastSeen - a.lastSeen);
    })
  );

  const useProgramMovementsByTemplateId = (programId?: string) =>
    DataState.from<Map<string, Movement[]>>(
      useQuery(
        ProgramMovementsAPI.queryKey,
        async () => {
          if (!DataState.isReady(programs) || !programId) return;
          const templateIds = programs.find(_ => _.id === programId)?.templateIds;
          if (templateIds === undefined) return Promise.reject('Unreachable: Program not found');
          // TODO use `in` query since array size will be < 10 (firebase limit) (it'll be 7)
          const promises = templateIds.map(templateId =>
            API.ProgramMovements.getAll(
              where('logId', '==', templateId),
              orderBy('position', 'asc')
            )
          );
          const movementsByTemplateId = await Promise.all(promises);
          return new Map(templateIds.map((id, index) => [id, movementsByTemplateId[index]]));
        },
        {
          enabled: DataState.isReady(programs) && programs.some(_ => _.id === programId)
        }
      )
    );

  const activeProgram = DataState.from<Program>(
    useQuery(
      // queryKey must differ from `programs` queryKey otherwise queries will mix data
      [ProgramsAPI.queryKey, programUser],
      async () => {
        if (!DataState.isReady(programUser)) return Promise.reject('programUser not ready.');
        if (programUser.activeProgramId === null) return DataState.Empty;
        return API.Programs.get(programUser.activeProgramId).then(p => Program.makeTemplateId(p));
      },
      { enabled: DataState.isReady(programUser) }
    )
  );

  const templates = DataState.from<ProgramLogTemplate[]>(
    useQuery(ProgramLogTemplatesAPI.queryKey, () => API.ProgramLogTemplates.getAll(user.uid))
  );

  const store = {
    ProgramsAPI,
    ProgramMovementsAPI,
    SavedMovementsAPI,
    TrainingLogsAPI,
    MovementsAPI,
    ProgramUsersAPI,
    ProgramLogTemplatesAPI,
    useMovements,
    useMovementsHistory,
    useTrainingLogsCount,
    useProgramMovementsByTemplateId,
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
