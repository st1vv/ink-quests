import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/app/auth/use-auth";
import { useDailyQuests, type Quest } from "@/app/quests/catalog";
import { useClaimQuest, useCompletions } from "@/app/quests/claims";
import { ApiError } from "@/lib/api";

// Completed comes from the server; the rest is the in-page flow of opening
// the quest and waiting a moment before the claim button appears.
type QuestStatus = "idle" | "started" | "claim_ready" | "completed";

type QuestItem = Quest & { status: QuestStatus };

export const HomeDailyQuests = () => {
  const dailyQuests = useDailyQuests();
  const completions = useCompletions();
  const [statuses, setStatuses] = useState<Record<number, QuestStatus>>({});
  const [timeLeft, setTimeLeft] = useState("");

  const quests: QuestItem[] = (dailyQuests.data ?? []).map((quest) => ({
    ...quest,
    status: completions.data?.has(quest.id)
      ? "completed"
      : (statuses[quest.id] ?? "idle"),
  }));
  const completedCount = quests.filter((q) => q.status === "completed").length;

  const handleStartQuest = (questId: number, actionUrl: string) => {
    window.open(actionUrl, "_blank", "noopener,noreferrer");
    setStatuses((prev) => ({ ...prev, [questId]: "started" }));

    window.setTimeout(() => {
      setStatuses((prev) =>
        prev[questId] === "started"
          ? { ...prev, [questId]: "claim_ready" }
          : prev,
      );
    }, 5000);
  };

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
    <Surface>
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
              step={index + 1}
              quest={quest}
              onStart={handleStartQuest}
            />
          ))}
        </div>
      </div>
    </Surface>
  );
};

type QuestRowProps = {
  step: number;
  quest: QuestItem;
  onStart: (questId: number, actionUrl: string) => void;
};

const QuestRow = ({ step, quest, onStart }: QuestRowProps) => {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const { status: authStatus } = useAuth();
  const { openConnectModal } = useConnectModal();
  const claim = useClaimQuest();

  useEffect(() => {
    if (quest.status !== "started") return;

    // setSecondsLeft(5);

    const intervalId = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [quest.status]);

  const isCompleted = quest.status === "completed";

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border p-4 transition md:flex-row md:items-center md:justify-between ${
        isCompleted
          ? "border-emerald-400/20 bg-emerald-400/5"
          : "border-white/10 bg-black/20 hover:border-white/20"
      }`}
    >
      <div className="flex min-w-0 gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            isCompleted
              ? "bg-emerald-400/15 text-emerald-300"
              : "bg-white/5 text-white/60"
          }`}
        >
          {isCompleted ? "✓" : step}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-semibold text-white md:text-lg">
              {quest.title}
            </h3>
            <Badge className="px-2 py-0.5 text-xs">+{quest.points} XP</Badge>
          </div>

          <p className="mt-1 text-sm leading-6 text-white/60">
            {quest.description}
          </p>

          {claim.isError && !isCompleted && (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {claim.error instanceof ApiError
                ? claim.error.message
                : "Couldn't reach the server. Try again."}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {quest.status === "idle" && (
          <Button
            onClick={() => onStart(quest.id, quest.actionUrl)}
            className="w-full md:w-auto"
          >
            Go to quest ↗
          </Button>
        )}

        {quest.status === "started" && (
          <Button disabled className="w-full tabular-nums md:w-auto">
            Claim in {secondsLeft}s
          </Button>
        )}

        {quest.status === "claim_ready" && !quest.claimable && (
          <Button disabled className="w-full md:w-auto">
            Verification soon
          </Button>
        )}

        {quest.status === "claim_ready" &&
          quest.claimable &&
          authStatus !== "authenticated" && (
            <Button
              variant="secondary"
              onClick={openConnectModal}
              disabled={authStatus === "loading"}
              className="w-full md:w-auto"
            >
              Sign in to claim
            </Button>
          )}

        {quest.status === "claim_ready" &&
          quest.claimable &&
          authStatus === "authenticated" && (
            <Button
              variant="secondary"
              onClick={() => claim.mutate(quest.id)}
              disabled={claim.isPending}
              className="w-full md:w-auto"
            >
              {claim.isPending ? "Checking…" : `Claim ${quest.points} XP`}
            </Button>
          )}

        {isCompleted && (
          <span className="w-full text-center text-sm font-semibold text-emerald-300 md:w-auto md:px-4">
            Completed
          </span>
        )}
      </div>
    </div>
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
