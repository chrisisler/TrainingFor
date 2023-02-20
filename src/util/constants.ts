/** https://date-fns.org/v2.22.1/docs/format */
export enum Format {
  /** @example "May 7" */
  date = 'MMM d',
  /** @example "12:53p" */
  time = 'h:mmaaaaa',
}

export enum TabIndex {
  NotFocusable = -1,
  Focusable = 0,
}

export enum Weekdays {
  Sunday,
  Monday,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
}

export enum Months {
  January,
  February,
  March,
  April,
  May,
  June,
  July,
  August,
  September,
  October,
  November,
  December,
}

export enum Milliseconds {
  Day = 86400000,
}

/** Valid route locations within the app. */
export const Paths = {
  account: '/account',
  training: '/training',
  editor: (logId = ':logId') => `${Paths.training}/log/${logId}`,
} as const;
