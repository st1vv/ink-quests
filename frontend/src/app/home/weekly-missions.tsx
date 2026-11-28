import { useEffect, useState, type ReactNode } from "react";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton, ValueSkeleton } from "@/shared/ui/skeleton";
import { CheckIcon } from "@/shared/ui/icons";
import { useRequireAuth } from "@/app/auth/use-require-auth";
import { ACTION_WIDTH } from "@/app/quests/quest-row";
import {
  useClaimWeeklyMission,
  useWeeklyMissions,
  type WeeklyMission,
} from "@/app/home/use-weekly-missions";

// Monday 00:00 UTC of next week: when the missions reset. Shown until the
// API's own resetsAt is in.
const nextUtcMonday = () => {
  const now = new Date();
  const daysLeft = (8 - now.getUTCDay()) % 7 || 7;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysLeft,
    ),
  ).toISOString();
};

// "3d 09:52:10" until the weekly reset; the days drop off on the last day.
const formatTimeLeft = (until: string) => {
  const diff = Math.max(0, new Date(until).getTime() - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff / 3_600_000) % 24);
  const minutes = Math.floor((diff / 60_000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const clock = [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return days > 0 ? `${days}d ${clock}` : clock;
};

// Worked out on every tick, so without a reset from the API it rolls over
// into the next week by itself.
const useTimeLeft = (until?: string) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const update = () => setTimeLeft(formatTimeLeft(until ?? nextUtcMonday()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [until]);
  return timeLeft;
};

export const HomeWeeklyMissions = () => {
  const weekly = useWeeklyMissions();
  const claim = useClaimWeeklyMission();
  const requireAuth = useRequireAuth();
  const timeLeft = useTimeLeft(weekly.data?.resetsAt);

  const missions = weekly.data?.missions ?? [];
  const claimedCount = missions.filter((m) => m.claimed).length;
  const claimMission = requireAuth((slug: string) => claim.mutate(slug));

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                Weekly missions
              </h2>
              <span className="text-sm text-white/40 tabular-nums">
                {weekly.isPending ? (
                  <ValueSkeleton className="w-8" />
                ) : (
                  missions.length > 0 && `${claimedCount}/${missions.length}`
                )}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-white/60">
              Bigger goals for the whole week, with bonus XP. New missions every
              Monday.
            </p>
          </div>
          {timeLeft && (
            <Badge className="shrink-0 items-center gap-2 self-start px-3 py-1.5 text-xs md:px-4 md:text-sm">
              <span>Resets in</span>
              <span className="font-semibold text-white tabular-nums">
                {timeLeft}
              </span>
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {weekly.isPending &&
            [0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                className="h-[110px] rounded-3xl border border-white/10 bg-white/[0.03]"
              />
            ))}

          {weekly.isError && (
            <Message>
              Couldn't load this week's missions.{" "}
              <button
                type="button"
                onClick={() => weekly.refetch()}
                className="cursor-pointer font-semibold text-ink-light hover:text-white"
              >
                Try again
              </button>
            </Message>
          )}

          {weekly.isSuccess && missions.length === 0 && (
            <Message>No missions this week. Check back on Monday.</Message>
          )}

          {missions.map((mission) => (
            <MissionRow
              key={mission.slug}
              mission={mission}
              claiming={claim.isPending && claim.variables === mission.slug}
              onClaim={() => claimMission(mission.slug)}
            />
          ))}
        </div>
      </div>
    </Surface>
  );
};

const MissionRow = ({
  mission,
  claiming,
  onClaim,
}: {
  mission: WeeklyMission;
  claiming: boolean;
  onClaim: () => void;
}) => {
  const done = mission.progress >= mission.target;

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border p-4 transition md:flex-row md:items-center md:justify-between ${
        mission.claimed
          ? "border-emerald-400/20 bg-emerald-400/5"
          : done
            ? "border-ink/50 bg-ink/10"
            : "border-white/10 bg-black/20 hover:border-white/20"
      }`}
    >
      <div className="flex min-w-0 flex-1 gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            mission.claimed
              ? "bg-emerald-400/15 text-emerald-300"
              : done
                ? "bg-ink/25 text-ink-light"
                : "bg-white/5 text-white/60"
          }`}
        >
          {mission.claimed || done ? (
            <CheckIcon />
          ) : (
            <span className="text-xs tabular-nums">
              {mission.progress}/{mission.target}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-semibold text-white md:text-lg">
              {mission.title}
            </h3>
            <Badge className="px-2 py-0.5 text-xs">+{mission.points} XP</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-white/60">
            {mission.description}
          </p>
          {!mission.claimed && (
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={mission.progress} max={mission.target} />
              <span className="shrink-0 text-xs text-white/60 tabular-nums">
                {mission.progress}/{mission.target}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* A mission in progress has no action: its bar says how far along. */}
      {(mission.claimed || done) && (
        <div className="flex shrink-0 md:items-center">
          {mission.claimed ? (
            <span
              className={`${ACTION_WIDTH} text-center text-sm font-semibold text-emerald-300`}
            >
              Claimed
            </span>
          ) : (
            <Button
              variant="secondary"
              onClick={onClaim}
              disabled={claiming}
              className={ACTION_WIDTH}
            >
              {claiming ? "Claiming…" : `Claim ${mission.points} XP`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const ProgressBar = ({ value, max }: { value: number; max: number }) => (
  <div
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={value}
    className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
  >
    <div
      className="h-full rounded-full bg-gradient-to-r from-ink to-ink-light transition-[width]"
      style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
    />
  </div>
);

const Message = ({ children }: { children: ReactNode }) => (
  <p className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
    {children}
  </p>
);
