import { User } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OptionsObject, useSnackbar } from 'notistack';

import { DataState, useDataState } from '../util';
import { API, auth } from '../api';
import { where } from 'firebase/firestore';
import { useUser } from '../context';

/**
 * Simplifies the usage of Material-UI's SwipeableDrawer and Menu.
 */
export const useMaterialMenu = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const openMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
    []
  );
  const closeMenu = useCallback(() => setAnchorEl(null), []);

  const menu = useMemo(
    () => ({
      open: !!anchorEl,
      onOpen: openMenu,
      onClose: closeMenu,
    }),
    [anchorEl, closeMenu, openMenu]
  );

  return menu;
};

// Equivalent to useMaterialMenu but with state data T attached.
export const useDrawer = <T extends unknown>() => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [data, setData] = useState<T | null>(null);

  const openMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget),
    []
  );
  const closeMenu = useCallback(() => {
    setAnchorEl(null);
    setData(null);
  }, []);

  const getMenu = useCallback(
    () => ({
      open: !!anchorEl,
      onOpen: openMenu,
      onClose: closeMenu,
    }),
    [anchorEl, closeMenu, openMenu]
  );

  return {
    ...getMenu(),
    anchorEl,
    props: getMenu,
    onOpen(event: React.MouseEvent<HTMLElement>, data: T) {
      setAnchorEl(event.currentTarget);
      setData(data);
    },
    getData: () => data,
    setData,
  };
};

export const useResizableInputRef = (): React.MutableRefObject<HTMLInputElement | null> => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resizeInput = useCallback((node: HTMLInputElement) => {
    if (node.value.length === 0) node.value = '0';
    node.style.width = node.value.length + 'ch';
  }, []);

  // Adjust the input element width to the length of the value
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    // @ts-ignore
    const listener = event => resizeInput(event.currentTarget);
    node.addEventListener('input', listener);
    node.addEventListener('blur', listener);
    return () => {
      node.removeEventListener('input', listener);
      node.removeEventListener('blur', listener);
    };
  }, [resizeInput]);

  // Immediately set the input size to the existing value length on render
  useEffect(() => {
    if (!inputRef.current) return;
    resizeInput(inputRef.current);
  }, [resizeInput]);

  return inputRef;
};

/**
 * Returns a version of the given state that can be compared against the latest
 * props.
 */
export function usePrevious<T>(value: T): T {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}

/**
 * Maps the state of authentication (in VS not in VS logging in VS failed) to
 * DataState and updates based on auth changes (log in and out).
 */
export const useUserAuthSubscription = (): [DataState<User>, (user: DataState<User>) => void] => {
  const [state, setState] = useState<DataState<User>>(DataState.Loading);

  useEffect(() => {
    return auth.onAuthStateChanged(
      user => {
        // If it exists, get the data (without the firebase metadata)
        if (user) setState(user.toJSON() as User);
        else setState(DataState.Empty);
      },
      err => {
        setState(DataState.error(err.message));
      }
    );
  }, []);

  return [state, setState];
};

/**
 * @usage
 * ```TypeScript
 * const toast = useToast();
 * toast.error('My message here!')
 * ```
 */
export const useToast = () => {
  const { enqueueSnackbar } = useSnackbar();

  const success = useCallback(
    (msg: string, opts: OptionsObject = { variant: 'success' }) => enqueueSnackbar(msg, opts),
    [enqueueSnackbar]
  );
  const info = useCallback(
    (msg: string, opts: OptionsObject = { variant: 'info' }) => enqueueSnackbar(msg, opts),
    [enqueueSnackbar]
  );
  const warning = useCallback(
    (msg: string, opts: OptionsObject = { variant: 'warning' }) => enqueueSnackbar(msg, opts),
    [enqueueSnackbar]
  );
  const error = useCallback(
    (msg: string, opts: OptionsObject = { variant: 'error' }) => {
      if (process.env.NODE_ENV === 'development') {
        console.error(msg);
      }
      return enqueueSnackbar(msg, opts);
    },
    [enqueueSnackbar]
  );

  return {
    success,
    info,
    warning,
    error,
  };
};

export const useProgramUser = () => {
  const user = useUser();
  return useDataState(
    () =>
      API.ProgramUsers.getAll(where('userUid', '==', user.uid)).then(users => {
        if (users.length > 0) {
          if (users.length > 1) {
            return DataState.error('Multiple programUsers found with the same userUid');
          }
          return users[0];
        }
        return DataState.Empty;
      }),
    [user.uid]
  );
};

export const useActiveProgram = () => {
  const [programUser] = useProgramUser();
  return useDataState(async () => {
    if (!DataState.isReady(programUser)) return DataState.Empty;
    if (!programUser.activeProgramId) return DataState.Empty;
    return API.Programs.get(programUser.activeProgramId);
  }, [programUser]);
};
