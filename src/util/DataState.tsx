import { Loading, Sorry } from '../components';

const DataStateEmpty = 'DataState::Empty' as const;
const DataStateLoading = 'DataState::Loading' as const;

/**
 * @typedef `DataState.Empty` Represents a data-less state.
 * @typedef `DataState.Loading` Represents a data-is-loading state.
 * @typedef `DataState.Error` Representing a failure state has occurred.
 * @typedef `T` Representing ready data and of the specified type.
 */
export type DataState<T> = typeof DataStateEmpty | typeof DataStateLoading | Error | T;

/** Wait for all provided DataStates to be ready. */
const dataStateAll: DataStateAll = (...dss) => dss.find(ds => !DataState.isReady(ds)) || dss;

interface DataStateAll {
  <A>(ds1: DataState<A>): DataState<[A]>;
  <A, B>(ds1: DataState<A>, ds2: DataState<B>): DataState<[A, B]>;
  <A, B, C>(ds1: DataState<A>, ds2: DataState<B>, ds3: DataState<C>): DataState<[A, B, C]>;
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
  error: (err: unknown): Error => {
    return err instanceof Error ? err : Error(String(err));
  },
  isEmpty<T>(ds: DataState<T>): ds is typeof DataStateEmpty {
    return ds === DataStateEmpty;
  },
  isLoading<T>(ds: DataState<T>): ds is typeof DataStateLoading {
    return ds === DataStateLoading;
  },
  isError<T>(ds: DataState<T>): ds is Error {
    return ds instanceof Error;
  },
  isReady<T>(ds: DataState<T>): ds is T {
    return !DataState.isError(ds) && !DataState.isLoading(ds) && ds !== DataStateEmpty;
  },
  map<T, U>(ds: DataState<T>, fn: (arg: T) => DataState<U>): DataState<U> {
    if (!DataState.isReady(ds)) return ds as DataState<U>;
    return fn(ds);
  },
  from<T>(state: { isLoading: boolean; error: unknown; data: T | undefined }): DataState<T> {
    if (state.error) return DataState.error(state.error);
    if (state.isLoading) return DataState.Loading;
    if (state.data === undefined) return DataState.Empty;
    return state.data;
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

export function DataStateView<T>(props: {
  data: DataState<T>;
  children: (data: T) => JSX.Element | null;
  loading: () => JSX.Element | null;
  // TODO Make this required
  error?: () => JSX.Element | null;
  empty?: () => JSX.Element | null;
}): JSX.Element | null {
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
}
