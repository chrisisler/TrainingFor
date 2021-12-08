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

// Valid route locations within the app
export const Paths = {
  account: '/account',
  logView: (userId = ':userId', logId = ':logId') =>
    `/user/${userId}/log/${logId}`,
  user: (userId = ':userId') => `/user/${userId}`,
  logEditor: (logId = ':logId') => `${Paths.training}/log/${logId}`,
  templateEditor: (templateId = ':templateId') =>
    `${Paths.training}/template/${templateId}`,
  templateView: (userId = ':userId', templateId = ':templateId') =>
    `/user/${userId}/template/${templateId}`,
  library: (userId = ':userId') => `/library/${userId}`,
  signUp: '/signup',
  logIn: '/login',
  timeline: '/timeline',
  training: '/training',
} as const;
