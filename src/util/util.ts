import { Months } from './constants';

export const dateDisplay = (date: Date) =>
  Months[date.getMonth()].slice(0, 3) + ' ' + date.getDate();
