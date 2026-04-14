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
    description: "Say GM on the official Ink platform",
    questUrl: "https://gm.inkonchain.com/",
    status: "idle",
    points: 20,
  },
  {
    id: 2,
    title: "Swap on the InkySwap",
    description:
      "Make a simple swap on the InkySwap to complete this daily quest.",
    questUrl: "https://inkyswap.com/swap",
    status: "idle",
    points: 30,
  },
  {
    id: 3,
    title: "Bridge to Ink using the Superbridge",
    description:
      "Bridge assets to Ink using the Superbridge and keep your streak alive.",
    questUrl: "#",
    status: "idle",
    points: 40,
  },
];

export const HomeDailyQuests = () => {
  const [quests, setQuests] = useState<QuestItem[]>(initialQuests);

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

  return (
    <Surface className="w-full max-w-full">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Daily quests
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {quests.map((quest) => (
            <QuestRow
              key={quest.id}
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
  quest: QuestItem;
  onStart: (questId: number, questUrl: string) => void;
  onClaim: (questId: number) => void;
};

const QuestRow = ({ quest, onStart, onClaim }: QuestRowProps) => {
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

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex gap-2 items-center">
          <h3 className="text-base font-semibold text-white md:text-lg">
            {quest.title}
          </h3>
          <Badge className="text-xs px-2 py-1">{quest.points} XP</Badge>
        </div>

        <p className="mt-1 text-sm leading-6 text-white/60">
          {quest.description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {quest.status === "idle" && (
          <Button onClick={() => onStart(quest.id, quest.questUrl)}>
            Go to quest
          </Button>
        )}

        {quest.status === "started" && (
          <Button disabled className="cursor-not-allowed opacity-60">
            Claim in {secondsLeft}s
          </Button>
        )}

        {quest.status === "claim_ready" && (
          <Button variant="secondary" onClick={() => onClaim(quest.id)}>
            Claim {quest.points} XP
          </Button>
        )}

        {quest.status === "completed" && (
          <Button
            variant="ghost"
            disabled
            className="cursor-not-allowed opacity-60"
          >
            Completed
          </Button>
        )}
      </div>
    </div>
  );
};
