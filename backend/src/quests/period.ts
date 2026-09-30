// Daily quests reset at 00:00 UTC, the same moment for every user.
// Completions store the period they count for; one-time quests all share
// a fixed period, so the unique (user, quest, period) index blocks repeats.
export const ONE_TIME_PERIOD = '1970-01-01';

export const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

// YYYY-MM-DD of the current UTC day, the format of a `date` column.
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

// Daily quests count per UTC day; partner quests once ever.
export const questPeriod = (kind: 'daily' | 'partner', now: Date) =>
  kind === 'daily' ? utcDay(now) : ONE_TIME_PERIOD;
