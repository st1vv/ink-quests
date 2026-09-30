import { useEffect, useState, type ReactNode } from "react";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";
import { useRequireAuth } from "@/app/auth/use-require-auth";
import { useDailyQuests } from "@/app/quests/catalog";
import { useCompletions } from "@/app/quests/claims";
import { QuestRow } from "@/app/quests/quest-row";
import { useQuestStatuses } from "@/app/quests/quest-status";

export const HomeDailyQuests = () => {
  const dailyQuests = useDailyQuests();
  const completions = useCompletions();
  const { items: quests, start } = useQuestStatuses(
    dailyQuests.data,
    completions.data,
  );
  const [timeLeft, setTimeLeft] = useState("");
  const requireAuth = useRequireAuth();

  const completedCount = quests.filter((q) => q.status === "completed").length;

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();

      // Daily quests reset at 00:00 UTC; 24 rolls over to the next day.
      const nextReset = new Date(now);
      nextReset.setUTCHours(24, 0, 0, 0);

      const diff = nextReset.getTime() - now.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
          2,
          "0",
        )}:${String(seconds).padStart(2, "0")}`,
      );
    };

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Surface className="h-full">
      <div className="flex flex-col gap-4">
        <div className="flex min-h-9 items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
              Daily quests
            </h2>
            <span className="text-sm text-white/40 tabular-nums">
              {completedCount}/{quests.length}
            </span>
          </div>
          {timeLeft && (
            <Badge className="items-center gap-2 px-3 py-1.5 text-xs md:px-4 md:text-sm">
              <span>Refresh in</span>
              <span className="font-semibold text-white tabular-nums">
                {timeLeft}
              </span>
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {dailyQuests.isPending && <QuestsPlaceholder />}
          {dailyQuests.isError && (
            <QuestsMessage>
              Couldn't load today's quests.{" "}
              <button
                type="button"
                onClick={() => dailyQuests.refetch()}
                className="cursor-pointer font-semibold text-ink-light hover:text-white"
              >
                Try again
              </button>
            </QuestsMessage>
          )}
          {dailyQuests.isSuccess && quests.length === 0 && (
            <QuestsMessage>
              No daily quests right now. Check back soon.
            </QuestsMessage>
          )}
          {quests.map((quest, index) => (
            <QuestRow
              key={quest.id}
              marker={index + 1}
              quest={quest}
              onStart={requireAuth(start)}
            />
          ))}
        </div>
      </div>
    </Surface>
  );
};

const QuestsPlaceholder = () =>
  [0, 1, 2].map((i) => (
    <div
      key={i}
      aria-hidden
      className="h-[86px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
    />
  ));

const QuestsMessage = ({ children }: { children: ReactNode }) => (
  <p className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
    {children}
  </p>
);
