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
  // Actions/Messages/Events
  ProgramLogTemplatesAPI: ReturnType<typeof useAPI<ProgramLogTemplate>>;
  ProgramMovementsAPI: ReturnType<typeof useAPI<Movement>>;
  SavedMovementsAPI: ReturnType<typeof useAPI<SavedMovement>>;
  TrainingLogsAPI: ReturnType<typeof useAPI<TrainingLog>>;
  ProgramUsersAPI: ReturnType<typeof useAPI<ProgramUser>>;
  MovementsAPI: ReturnType<typeof useAPI<Movement>>;
  ProgramsAPI: ReturnType<typeof useAPI<Program>>;
  useMovementsHistory(savedMovementId: string): DataState<Movement[]>;
  useMovements(logId: string, isProgramView?: boolean): DataState<Movement[]>;
  useProgramMovementsByTemplateId(templateIds?: string[]): DataState<Map<string, Movement[]>>;
  // State/Model/Data
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

  const isProgramView = false;
  const ProgramMovementsAPI = useAPI(API.ProgramMovements, [
    DbPath.ProgramMovements,
    isProgramView,
    user.uid,
  ]);
  const MovementsAPI = useAPI(API.Movements, [DbPath.Movements, isProgramView, user.uid]);
  const SavedMovementsAPI = useAPI(API.SavedMovements, [DbPath.SavedMovements, user.uid]);
  const TrainingLogsAPI = useAPI(API.TrainingLogs, [DbPath.Logs, user.uid]);
  const ProgramsAPI = useAPI(API.Programs, [DbPath.Programs, user.uid]);
  const ProgramUsersAPI = useAPI(API.ProgramUsers, [DbPath.ProgramUsers, user.uid]);
  const ProgramLogTemplatesAPI = useAPI(API.ProgramLogTemplates, [
    DbPath.ProgramLogTemplates,
    user.uid,
  ]);

  const logs = DataState.from<TrainingLog[]>(
    useQuery(TrainingLogsAPI.queryKey, () =>
      API.TrainingLogs.getAll(user.uid, orderBy('timestamp', 'desc'), limit(12))
    )
  );

  const movementsByLogId = DataState.from<Map<string, Movement[]>>(
    useQuery(
      MovementsAPI.queryKey,
      async () => {
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
      useQuery(
        [isProgramView ? DbPath.ProgramMovements : DbPath.Movements, isProgramView, user.uid],
        () =>
          (isProgramView ? API.ProgramMovements : API.Movements).getAll(
            where('logId', '==', logId),
            orderBy('position', 'asc')
          )
      )
    );

  const useMovementsHistory = (savedMovementId: string) =>
    DataState.from<Movement[]>(
      useQuery(MovementsAPI.queryKey, () =>
        API.Movements.getAll(
          where('savedMovementId', '==', savedMovementId),
          orderBy('timestamp', 'desc')
        )
      )
    );

  const useProgramMovementsByTemplateId = (templateIds?: string[]) =>
    DataState.from<Map<string, Movement[]>>(
      useQuery(
        ProgramMovementsAPI.queryKey,
        async () => {
          if (!templateIds) return new Map();
          // For each log template fetch each movement
          // TODO use `in` query since array size will be < 10 (firebase limit)
          const promises = templateIds.map(templateId =>
            API.ProgramMovements.getAll(
              where('logId', '==', templateId),
              orderBy('position', 'asc')
            )
          );
          const movementsByTemplateId = await Promise.all(promises);
          // Group lists of movements by templateId
          const map = new Map<string, Movement[]>(templateIds.map(templateId => [templateId, []]));
          templateIds.forEach((templateId, index) => {
            map.get(templateId)?.push(...movementsByTemplateId[index]);
          });
          return map;
        },
        { enabled: !!templateIds }
      )
    );

  const programUser = DataState.from<ProgramUser>(
    useQuery([DbPath.ProgramUsers, user.uid], async () => { // TODO QueryKey
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

  const savedMovements = DataState.from<SavedMovement[]>(
    useQuery(SavedMovementsAPI.queryKey, async () => {
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
    })
  );

  const activeProgram = DataState.from<Program>(
    useQuery(
      [DbPath.Programs, user.uid, programUser], // TODO ???
      async () => {
        if (!DataState.isReady(programUser)) return Promise.reject('programUser not ready.');
        if (!programUser.activeProgramId) throw TypeError('activeProgramId not found');
        return API.Programs.get(programUser.activeProgramId).then(p => Program.makeTemplateId(p));
      },
      { enabled: DataState.isReady(programUser) }
    )
  );

  const templates = DataState.from<ProgramLogTemplate[]>(
    useQuery(
      ProgramLogTemplatesAPI.queryKey,
      () => {
        if (!DataState.isReady(activeProgram)) return Promise.reject('activeProgram not ready.');
        return API.ProgramLogTemplates.getAll(
          user.uid,
          where('id', 'in', activeProgram.templateIds)
        );
      },
      { enabled: DataState.isReady(activeProgram) }
    )
  );

  Object.assign(TrainingLogsAPI, {
    async delete(logId: string) {
      await Promise.all([
        TrainingLogsAPI.delete(logId),
        MovementsAPI.deleteMany(where('logId', '==', logId)),
      ]);
    },
  });

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
