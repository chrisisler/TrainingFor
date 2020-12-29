import React, { useState, useEffect } from 'react';

import { Loading } from './components/Loading';

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
    fn: (arg: T) => DataState<U>
  ): DataState<U> => {
    if (!DataState.isReady(ds)) return ds;
    return fn(ds);
  },
  unwrapOr: <T extends unknown, U extends T>(
    ds: DataState<T>,
    alt: U
  ): T | U => {
    if (DataState.isReady(ds)) return ds;
    return alt;
  },
  /**
   * Return the contained value or throw an Error if it is in any non-ready
   * state.
   */
  unwrap: <T extends unknown>(ds: DataState<T>): T => {
    if (DataState.isReady(ds)) return ds;
    throw Error('Called `DataState.unwrap(x)` on not ready data');
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
  loading?: () => JSX.Element | null;
  error: () => JSX.Element | null;
  empty?: () => JSX.Element | null;
}): JSX.Element | null => {
  if (DataStateEmpty === props.data) return props.empty?.() ?? null;
  if (DataState.isLoading(props.data)) return props.loading?.() ?? <Loading />;
  if (DataState.isError(props.data)) return props.error();
  return props.children(props.data);
};
