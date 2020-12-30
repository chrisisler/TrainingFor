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
  logView: (userId: string = ':userId', logId: string = ':logId') =>
    `/user/${userId}/log/${logId}`,
  user: (userId: string = ':userId') => `/user/${userId}`,
  logEditor: (logId: string = ':logId') => `/log/${logId}`,
  welcome: '/welcome',
  signUp: '/welcome/signup',
  logIn: '/welcome/login',
  timeline: '/timeline',
  newTraining: '/',
};
