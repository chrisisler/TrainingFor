export enum Format {
  date = 'EEEEEE M - d',
  time = 'h:mm aaa',
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

export enum Milliseconds {
  Day = 86400000,
}

export const Paths = {
  account: '/account',
  logView: (userId = ':userId', logId = ':logId') =>
    `/user/${userId}/log/${logId}`,
  user: (userId = ':userId') => `/user/${userId}`,
  logEditor: (logId = ':logId') => `/log/${logId}`,
  signUp: '/signup',
  logIn: '/login',
  timeline: '/timeline',
  newTraining: '/',
};
