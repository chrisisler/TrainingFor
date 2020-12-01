import React, { useState, useEffect } from 'react';

const DataStateEmpty = 'DataState::Empty' as const;
const DataStateLoading = 'DataState::Loading' as const;

export type DataState<T> =
  | typeof DataStateEmpty
  | typeof DataStateLoading
  | Error
  | T;

// eslint-disable-next-line
export const DataState = {
  Empty: DataStateEmpty,
  Loading: DataStateLoading,
  error: (message?: string): Error => {
    return Error(message ?? 'Something went wrong.');
  },
  isEmpty: <T extends unknown>(
    ds: DataState<T>
  ): ds is typeof DataStateEmpty => {
    return ds === DataStateEmpty;
  },
  isLoading: <T extends unknown>(
    ds: DataState<T>
  ): ds is typeof DataStateLoading => {
    return ds === DataStateLoading;
  },
  isError: <T extends unknown>(ds: DataState<T>): ds is Error => {
    return ds instanceof Error;
  },
  isReady: <T extends unknown>(ds: DataState<T>): ds is T => {
    return (
      !DataState.isError(ds) &&
      !DataState.isLoading(ds) &&
      ds !== DataStateEmpty
    );
  },
  map: <T extends unknown, U extends unknown>(
    ds: DataState<T>,
    fn: (arg: T) => U
  ): DataState<U> => {
    if (!DataState.isReady(ds)) return ds;
    return fn(ds);
  },
};

export const useDataState = <T extends unknown>(
  getData: () => Promise<DataState<T>>,
  deps: readonly unknown[]
): [DataState<T>, React.Dispatch<React.SetStateAction<DataState<T>>>] => {
  const [dataState, setDataState] = useState<DataState<T>>(DataState.Loading);
  useEffect(() => {
    let stale = false;
    getData()
      .then(data => {
        if (!stale) setDataState(data);
      })
      .catch(error => {
        console.log('[DTASTATE]:error is:', error);
        console.log('getData is:', getData);
        if (!stale) setDataState(DataState.error(error.message));
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [dataState, setDataState];
};

export const DataStateView = <T extends unknown>(props: {
  data: DataState<T>;
  children: (data: T) => JSX.Element | null;
  loading: () => JSX.Element | null;
  error: () => JSX.Element | null;
  empty?: () => JSX.Element | null;
}): JSX.Element | null => {
  if (DataStateEmpty === props.data) return props.empty?.() ?? null;
  if (DataState.isLoading(props.data)) return props.loading();
  if (DataState.isError(props.data)) return props.error();
  return props.children(props.data);
};
