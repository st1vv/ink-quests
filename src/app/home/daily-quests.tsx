import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";

type QuestStatus = "idle" | "started" | "claim_ready" | "completed";

type QuestItem = {
  id: number;
  title: string;
  description: string;
  questUrl: string;
  status: QuestStatus;
  points: number;
};

const initialQuests: QuestItem[] = [
  {
    id: 1,
    title: "Say GM",
    description: "Say GM on the official platform.",
    questUrl: "https://gm.inkonchain.com/",
    status: "idle",
    points: 20,
  },
  {
    id: 2,
    title: "Swap on InkySwap",
    description:
      "Make a simple swap on InkySwap to complete this daily quest.",
    questUrl: "https://inkyswap.com/swap",
    status: "idle",
    points: 30,
  },
  {
    id: 3,
    title: "Bridge to Ink using Superbridge",
    description:
      "Bridge assets to Ink using Superbridge and keep your streak alive.",
    questUrl: "https://superbridge.app/?fromChainId=1&toChainId=57073",
    status: "idle",
    points: 40,
  },
];

export const HomeDailyQuests = () => {
  const [quests, setQuests] = useState<QuestItem[]>(initialQuests);
  const [timeLeft, setTimeLeft] = useState("");

  const completedCount = quests.filter((q) => q.status === "completed").length;

  const handleStartQuest = (questId: number, questUrl: string) => {
    window.open(questUrl, "_blank", "noopener,noreferrer");

    setQuests((prev) =>
      prev.map((quest) =>
        quest.id === questId ? { ...quest, status: "started" } : quest,
      ),
    );

    window.setTimeout(() => {
      setQuests((prev) =>
        prev.map((quest) =>
          quest.id === questId && quest.status === "started"
            ? { ...quest, status: "claim_ready" }
            : quest,
        ),
      );
    }, 5000);
  };

  const handleClaimQuest = (questId: number) => {
    setQuests((prev) =>
      prev.map((quest) =>
        quest.id === questId ? { ...quest, status: "completed" } : quest,
      ),
    );
  };

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();

      const nextReset = new Date();
      nextReset.setHours(12, 0, 0, 0);

      if (now >= nextReset) {
        nextReset.setDate(nextReset.getDate() + 1);
      }

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
          {quests.map((quest, index) => (
            <QuestRow
              key={quest.id}
              step={index + 1}
              quest={quest}
              onStart={handleStartQuest}
              onClaim={handleClaimQuest}
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
  onStart: (questId: number, questUrl: string) => void;
  onClaim: (questId: number) => void;
};

const QuestRow = ({ step, quest, onStart, onClaim }: QuestRowProps) => {
  const [secondsLeft, setSecondsLeft] = useState(5);

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
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {quest.status === "idle" && (
          <Button
            onClick={() => onStart(quest.id, quest.questUrl)}
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

        {quest.status === "claim_ready" && (
          <Button
            variant="secondary"
            onClick={() => onClaim(quest.id)}
            className="w-full md:w-auto"
          >
            Claim {quest.points} XP
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
