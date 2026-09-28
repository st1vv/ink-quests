import { utcDay } from '../quests/period';

const DAY_MS = 24 * 60 * 60 * 1000;

// Consecutive UTC days, up to today, with a check-in.
// A streak whose last day is yesterday is still alive until today ends.
// `days` are distinct YYYY-MM-DD strings, newest first.
export const currentStreak = (days: string[], now: Date) => {
  const today = utcDay(now);
  const yesterday = utcDay(new Date(now.getTime() - DAY_MS));
  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const expected = utcDay(new Date(Date.parse(days[i - 1]) - DAY_MS));
    if (days[i] !== expected) break;
    streak++;
  }
  return streak;
};

// Longest run of consecutive UTC days ever, in any order of `days`.
export const longestStreak = (days: string[]) => {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    const follows =
      i > 0 && Date.parse(sorted[i]) - Date.parse(sorted[i - 1]) === DAY_MS;
    run = follows ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};
