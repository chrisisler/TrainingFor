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
  Sunday = 'Sunday',
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
}

export const SORTED_WEEKDAYS = [
  Weekdays.Sunday,
  Weekdays.Monday,
  Weekdays.Tuesday,
  Weekdays.Wednesday,
  Weekdays.Thursday,
  Weekdays.Friday,
  Weekdays.Saturday,
];

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
  program: (programId = ':programId', title = "") => {
    if (title) {
      document.title = title + ' - Trainquil';
    }

    return `/program/${programId}`;
  },

  /** To navigate to nearest log, use `Paths.editor("")`. */
  editor: (logId = ':logId', title = "") => {
    if (title) {
      document.title = title + ' - Trainquil';;
    }

    return `/training/log/${logId}`;
  },
};
