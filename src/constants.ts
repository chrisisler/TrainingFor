export enum Format {
  date = 'EEE MMM d',
  time = 'h:mm a',
}

export const Paths = {
  account: '/account',
  logEditor: (logId: string = ':logId') => `/log/${logId}`,
  welcome: '/welcome',
  signUp: '/welcome/signup',
  logIn: '/welcome/login',
  timeline: '/timeline',
  newTraining: '/',
};
