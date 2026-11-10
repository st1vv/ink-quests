// The validated dark-surface categorical slots, in order: blue, orange.
export const SERIES_COLORS = ["#3987e5", "#d95926"] as const;

export type Series = { label: string; color: string; values: number[] };

// Nov 3, from a UTC day (YYYY-MM-DD).
export const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
