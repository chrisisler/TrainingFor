export enum Format {
  date = 'EEEEEE M - d',
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

export const Paths = {
  account: '/account',
  logView: (userId = ':userId', logId = ':logId') =>
    `/user/${userId}/log/${logId}`,
  user: (userId = ':userId') => `/user/${userId}`,
  logEditor: (logId = ':logId') => `/log/${logId}`,
  // TODO Rename 'template' to 'templateEditor'
  template: (templateId = ':templateId') => `/template/${templateId}`,
  templateView: (userId = ':userId', templateId = ':templateId') =>
    `/user/${userId}/template/${templateId}`,
  library: (userId = ':userId') => `/library/${userId}`,
  signUp: '/signup',
  logIn: '/login',
  timeline: '/timeline',
  newTraining: '/',
};
