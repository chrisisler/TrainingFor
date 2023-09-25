import { User } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OptionsObject, useSnackbar } from 'notistack';

import { DataState } from '../util';
import { auth } from '../api';

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
 * @usage
 * ```TypeScript
 * const toast = useToast();
 * toast.error('My message here!')
 * ```
 */
export const useToast = () => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const info = useCallback(
    (msg: string, opts: OptionsObject = { variant: 'info' }) => enqueueSnackbar(msg, opts),
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

  return { info, error, close: closeSnackbar };
};
