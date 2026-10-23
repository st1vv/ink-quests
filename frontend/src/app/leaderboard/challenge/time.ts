import { useEffect, useState } from "react";

// The current time, refreshed every minute for countdowns.
export const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
};

// "2d 5h", "3h 12m" or "12m" until `iso`.
export const countdown = (iso: string, now: number) => {
  const minutes = Math.max(0, Math.ceil((Date.parse(iso) - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

// "Oct 26 – Nov 1 (UTC)": the challenge's first and last UTC day; endsAt
// itself is the moment it closes, so the last day is the one before.
export const formatUtcRange = (startsAt: string, endsAt: string) => {
  const day = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    });
  return `${day(Date.parse(startsAt))} – ${day(Date.parse(endsAt) - 1)} (UTC)`;
};
