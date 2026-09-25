import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/surface";
import { StatCard } from "@/shared/ui/stat-card";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import { useRequireAuth } from "@/app/auth/use-require-auth";
import { CHECK_IN_XP, useCheckIn, useProgress } from "@/app/home/use-progress";

const PLACEHOLDER = "—";

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
      <div className="flex h-full flex-col gap-4">
        <div className="flex min-h-9 items-center">
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Your progress
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Daily streak"
            value={
              progress
                ? `🔥 ${progress.streak} ${progress.streak === 1 ? "day" : "days"}`
                : PLACEHOLDER
            }
          />
          <StatCard label="Level" value={progress?.level ?? PLACEHOLDER} />

          <div className="col-span-2">
            <StatCard
              label="Total XP"
              value={
                progress ? `${formatNumber(progress.totalXp)} XP` : PLACEHOLDER
              }
            >
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
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
            </StatCard>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {progress?.checkedInToday ? (
            <Button variant="ghost" disabled className="w-full">
              ✓ Checked in today
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
                : `Daily Check-in · +${CHECK_IN_XP} XP`}
            </Button>
          )}

          {checkIn.isError && (
            <p role="alert" className="text-center text-sm text-rose-300">
              Couldn't check in. Try again.
            </p>
          )}
        </div>
      </div>
    </Surface>
  );
};
