import { useEffect, useState, type ReactNode } from "react";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton, ValueSkeleton } from "@/shared/ui/skeleton";
import { CheckIcon, GiftIcon } from "@/shared/ui/icons";
import { useRequireAuth } from "@/app/auth/use-require-auth";
import { ACTION_WIDTH } from "@/app/quests/quest-row";
import { tagVariant } from "@/app/quests/tag-colors";
import {
  BONUS_SLUG,
  nextUtcMonday,
  useClaimWeeklyMission,
  useWeeklyMissions,
  type WeeklyMission,
} from "@/app/home/use-weekly-missions";

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

// Until the given reset, or the next Monday 00:00 UTC when there's none
// (yet), worked out on every tick so it rolls over into the next week.
const useTimeLeft = (until?: string) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const update = () =>
      setTimeLeft(formatTimeLeft(until ?? nextUtcMonday().toISOString()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [until]);
  return timeLeft;
};

// The missions aren't live yet: the block shows the weekly timer and a
// "coming soon" note. Set to false once the backend serves them.
const COMING_SOON = true;

export const HomeWeeklyMissions = () =>
  COMING_SOON ? <WeeklyComingSoon /> : <WeeklyMissionsList />;

const WeeklyHeader = ({
  count,
  timeLeft,
}: {
  count?: ReactNode;
  timeLeft: string;
}) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
    <div>
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
          Weekly missions
        </h2>
        {count && (
          <span className="text-sm text-white/40 tabular-nums">{count}</span>
        )}
      </div>
      <p className="mt-1 text-sm leading-6 text-white/60">
        Bigger goals for the whole week. Progress counts from your daily quests
        and campaigns.
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
);

const WeeklyComingSoon = () => {
  const timeLeft = useTimeLeft();
  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <WeeklyHeader timeLeft={timeLeft} />
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/15 text-ink-light">
            <GiftIcon className="h-6 w-6" />
          </span>
          <h3 className="text-lg font-semibold text-white">Coming soon</h3>
          <p className="max-w-md text-sm leading-6 text-white/60">
            Weekly missions with bonus XP are almost here. Keep up your daily
            quests and check back soon.
          </p>
        </div>
      </div>
    </Surface>
  );
};

const WeeklyMissionsList = () => {
  const weekly = useWeeklyMissions();
  const claim = useClaimWeeklyMission();
  const requireAuth = useRequireAuth();
  const data = weekly.data;
  const timeLeft = useTimeLeft(data?.resetsAt);

  const missions = data?.missions ?? [];
  const claimedCount = missions.filter((m) => m.claimed).length;
  const allClaimed = missions.length > 0 && claimedCount === missions.length;

  const claimMission = requireAuth((slug: string, points: number) =>
    claim.mutate({ slug, points }),
  );

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <WeeklyHeader
          timeLeft={timeLeft}
          count={
            weekly.isPending ? (
              <ValueSkeleton className="w-8" />
            ) : (
              `${claimedCount}/${missions.length}`
            )
          }
        />

        <div className="flex flex-col gap-3">
          {weekly.isPending &&
            [0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                className="h-[94px] rounded-3xl border border-white/10 bg-white/[0.03]"
              />
            ))}

          {missions.map((mission) => (
            <MissionRow
              key={mission.slug}
              mission={mission}
              claiming={
                claim.isPending && claim.variables?.slug === mission.slug
              }
              onClaim={() => claimMission(mission.slug, mission.points)}
            />
          ))}

          {data && (
            <BonusRow
              points={data.bonus.points}
              claimed={data.bonus.claimed}
              unlocked={allClaimed}
              claimedCount={claimedCount}
              total={missions.length}
              claiming={claim.isPending && claim.variables?.slug === BONUS_SLUG}
              onClaim={() => claimMission(BONUS_SLUG, data.bonus.points)}
            />
          )}
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
  const left = mission.target - mission.progress;

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
            <div className="mt-3 flex flex-col gap-2">
              {mission.steps && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {mission.steps.map((step) => (
                    <Badge
                      key={step.label}
                      variant={tagVariant(step.label)}
                      className="items-center gap-1 px-2 py-0.5 text-xs"
                    >
                      {step.done && <CheckIcon className="h-3 w-3" />}
                      {step.label}
                    </Badge>
                  ))}
                  {Array.from(
                    {
                      length: Math.max(
                        0,
                        mission.target - mission.steps.length,
                      ),
                    },
                    (_, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-xs text-white/50"
                      >
                        any other
                      </span>
                    ),
                  )}
                </div>
              )}
              <ProgressBar value={mission.progress} max={mission.target} />
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 md:items-center">
        {mission.claimed ? (
          <span
            className={`${ACTION_WIDTH} text-center text-sm font-semibold text-emerald-300`}
          >
            Claimed
          </span>
        ) : done ? (
          <Button
            variant="secondary"
            onClick={onClaim}
            disabled={claiming}
            className={ACTION_WIDTH}
          >
            {claiming ? "Claiming…" : `Claim ${mission.points} XP`}
          </Button>
        ) : (
          <span
            className={`${ACTION_WIDTH} text-center text-sm text-white/50 tabular-nums`}
          >
            {left} to go
          </span>
        )}
      </div>
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

const BonusRow = ({
  points,
  claimed,
  unlocked,
  claimedCount,
  total,
  claiming,
  onClaim,
}: {
  points: number;
  claimed: boolean;
  unlocked: boolean;
  claimedCount: number;
  total: number;
  claiming: boolean;
  onClaim: () => void;
}) => (
  <div
    className={`flex flex-col gap-4 rounded-3xl border p-4 md:flex-row md:items-center md:justify-between ${
      claimed
        ? "border-emerald-400/20 bg-emerald-400/5"
        : unlocked
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-dashed border-white/15"
    }`}
  >
    <div className="flex min-w-0 flex-1 gap-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          claimed
            ? "bg-emerald-400/15 text-emerald-300"
            : "bg-amber-400/15 text-amber-300"
        }`}
      >
        {claimed ? <CheckIcon /> : <GiftIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-base font-semibold text-white md:text-lg">
            Weekly bonus
          </h3>
          <Badge variant="amber" className="px-2 py-0.5 text-xs">
            +{points} XP
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-6 text-white/60">
          Claim all {total} missions this week to unlock it.
        </p>
        {!claimed && (
          <div className="mt-3 flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < claimedCount ? "bg-amber-300" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    <div className="flex shrink-0 md:items-center">
      {claimed ? (
        <span
          className={`${ACTION_WIDTH} text-center text-sm font-semibold text-emerald-300`}
        >
          Claimed
        </span>
      ) : unlocked ? (
        <Button
          variant="secondary"
          onClick={onClaim}
          disabled={claiming}
          className={ACTION_WIDTH}
        >
          {claiming ? "Claiming…" : `Claim ${points} XP`}
        </Button>
      ) : (
        <span
          className={`${ACTION_WIDTH} text-center text-sm text-white/50 tabular-nums`}
        >
          {claimedCount} of {total}
        </span>
      )}
    </div>
  </div>
);
