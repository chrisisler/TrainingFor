export enum Format {
  date = 'EEE MMM d',
  time = 'h:mm a',
}

export enum TabIndex {
  NotFocusable = -1,
  Focusable = 0,
}

export const Paths = {
  account: '/account',
  logView: (userId = ':userId', logId = ':logId') =>
    `/user/${userId}/log/${logId}`,
  user: (userId = ':userId') => `/user/${userId}`,
  logEditor: (logId = ':logId') => `/log/${logId}`,
  welcome: '/welcome',
  signUp: '/welcome/signup',
  logIn: '/welcome/login',
  timeline: '/timeline',
  newTraining: '/',
};
