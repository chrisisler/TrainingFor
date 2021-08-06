import React, { useEffect, useState } from 'react';

import { Loading } from './components/Loading';
import { Sorry } from './components/Sorry';

const DataStateEmpty = 'DataState::Empty' as const;
const DataStateLoading = 'DataState::Loading' as const;

/**
 * @typedef `DataState.Empty` Represents a data-less state.
 * @typedef `DataState.Loading` Represents a data-is-loading state.
 * @typedef `DataState.Error` Representing a failure state has occurred.
 * @typedef `T` Representing ready data and of the specified type.
 */
export type DataState<T> =
  | typeof DataStateEmpty
  | typeof DataStateLoading
  | Error
  | T;

/** Wait for all provided DataStates to be ready. */
const dataStateAll: DataStateAll = (...dss) => {
  const notReady = dss.find(ds => !DataState.isReady(ds));
  if (notReady) return notReady;
  return dss;
};

interface DataStateAll {
  <A>(ds1: DataState<A>): DataState<[A]>;
  <A, B>(ds1: DataState<A>, ds2: DataState<B>): DataState<[A, B]>;
  <A, B, C>(ds1: DataState<A>, ds2: DataState<B>, ds3: DataState<C>): DataState<
    [A, B, C]
  >;
  <A, B, C, D>(
    ds1: DataState<A>,
    ds2: DataState<B>,
    ds3: DataState<C>,
    ds4: DataState<D>
  ): DataState<[A, B, C, D]>;
}

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
    if (!DataState.isReady(ds)) return ds as DataState<U>;
    return fn(ds);
  },
  unwrapOr: <T extends unknown, U extends unknown>(
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
  /**
   * Converts an array of DataState into a DataState<T[]>.
   *
   * Providing generics is required for TypeScript to recognize the ready
   * result.
   *
   * @example DataState.all<[string, number]>(str, num);
   */
  all: dataStateAll,
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
        console.error(error);
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
  error?: () => JSX.Element | null;
  empty?: () => JSX.Element | null;
}): JSX.Element | null => {
  if (DataStateEmpty === props.data) {
    if (props.empty) return props.empty();
    return null;
  }
  if (DataState.isLoading(props.data)) {
    if (props.loading) return props.loading();
    return <Loading />;
  }
  if (DataState.isError(props.data)) {
    if (props.error) return props.error();
    return <Sorry />;
  }
  return props.children(props.data);
};
