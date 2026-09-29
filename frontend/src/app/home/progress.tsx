import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/surface";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import { useRequireAuth } from "@/app/auth/use-require-auth";
import { useCheckIn, useProgress } from "@/app/home/use-progress";

const PLACEHOLDER = "—";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NO_CHECK_INS = WEEKDAYS.map(() => false);

// Blocks here are compact on purpose: the daily quests card stretches to
// this card's height, so every extra pixel here is empty space there.
export const HomeProgress = () => {
  const { status: authStatus } = useAuth();
  const requireAuth = useRequireAuth();
  // Signed-out visitors and the first load show placeholders.
  const { data: progress } = useProgress();
  const checkIn = useCheckIn();

  // How far into the current level, not from zero, so the bar restarts
  // after each level-up.
  const levelProgress = progress
    ? ((progress.totalXp - progress.levelXp) /
        (progress.nextLevelXp - progress.levelXp)) *
      100
    : 0;

  return (
    <Surface className="h-full">
      <div className="flex h-full flex-col gap-3">
        <div className="flex min-h-9 items-center">
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Your progress
          </h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-white/50">Daily streak</p>
            <p className="font-semibold text-white tabular-nums">
              {progress
                ? `${progress.streak} ${progress.streak === 1 ? "day" : "days"}`
                : PLACEHOLDER}
            </p>
          </div>
          <WeekFlames week={progress?.week ?? NO_CHECK_INS} />
          <p className="mt-2 text-xs text-white/40">
            {!progress
              ? "Check in every day to build your streak"
              : progress.week.every(Boolean)
                ? `Full week! +${progress.fullWeekBonusXp} XP bonus earned`
                : `Check in Monday to Sunday for +${progress.fullWeekBonusXp} XP bonus`}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-white/50">Total XP</p>
            <p className="font-semibold text-white tabular-nums">
              {progress ? (
                <>
                  {formatNumber(progress.totalXp)} XP{" "}
                  <span className="font-medium text-white/50">
                    (Lvl {progress.level})
                  </span>
                </>
              ) : (
                PLACEHOLDER
              )}
            </p>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-linear-to-r from-ink to-ink-light"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/40">
            {progress
              ? `${formatNumber(progress.nextLevelXp - progress.totalXp)} XP to level ${progress.level + 1}`
              : "Sign in to track your XP and streak"}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {progress?.checkedInToday ? (
            <Button variant="ghost" disabled className="w-full">
              Checked in today
            </Button>
          ) : (
            <Button
              onClick={requireAuth(() => checkIn.mutate())}
              disabled={
                authStatus === "loading" ||
                (authStatus === "authenticated" && !progress) ||
                checkIn.isPending
              }
              className="w-full"
            >
              {checkIn.isPending
                ? "Checking in…"
                : progress
                  ? `Daily Check-in (+${progress.checkInXp} XP)`
                  : "Daily Check-in"}
            </Button>
          )}
        </div>
      </div>
    </Surface>
  );
};

// Monday to Sunday of the current UTC week; lit where the user checked in.
const WeekFlames = ({ week }: { week: boolean[] }) => {
  const today = (new Date().getUTCDay() + 6) % 7;

  return (
    <ol className="mt-2.5 grid grid-cols-7 gap-1">
      {week.map((checkedIn, i) => (
        <li
          key={WEEKDAYS[i]}
          aria-label={`${WEEKDAYS[i]}: ${checkedIn ? "checked in" : "not checked in"}`}
          className="flex flex-col items-center gap-0.5"
        >
          <span
            aria-hidden
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
              checkedIn ? "bg-ink/20" : "bg-white/5"
            } ${i === today ? "ring-1 ring-ink-light/60" : ""}`}
          >
            <span className={checkedIn ? "" : "opacity-25 grayscale"}>🔥</span>
          </span>
          <span
            className={`text-[10px] font-medium uppercase tracking-wide ${
              i === today ? "text-white" : "text-white/40"
            }`}
          >
            {WEEKDAYS[i].slice(0, 2)}
          </span>
        </li>
      ))}
    </ol>
  );
};
