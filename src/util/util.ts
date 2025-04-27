import { Months } from './constants';

export const dateDisplay = (date: Date) =>
  Months[date.getMonth()].slice(0, 3) + ' ' + date.getDate();

export const ordinalSuffix = (n: number) => {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

export const ord = (n: number): string => {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;

  if (lastTwoDigits === 11 || lastTwoDigits === 12 || lastTwoDigits === 13) {
    return 'th';
  }

  switch (lastDigit) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
