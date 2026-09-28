import { utcDay } from '../quests/period';

const DAY_MS = 24 * 60 * 60 * 1000;

// The seven YYYY-MM-DD days, Monday to Sunday, of the UTC week `now` is in.
export const utcWeekDays = (now: Date) => {
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  const monday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - sinceMonday,
  );
  return Array.from({ length: 7 }, (_, i) =>
    utcDay(new Date(monday + i * DAY_MS)),
  );
};

// A check-in on Sunday completes the week when Monday to Saturday are all
// checked in too. `checkedIn` holds the user's earlier check-in days.
export const completesWeek = (checkedIn: Set<string>, now: Date) => {
  const days = utcWeekDays(now);
  return (
    days[6] === utcDay(now) && days.slice(0, 6).every((d) => checkedIn.has(d))
  );
};
