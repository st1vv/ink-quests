import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useRequireAuth } from "@/app/auth/use-require-auth";
import { useClaimQuest } from "@/app/quests/claims";
import { CLAIM_DELAY_S, type QuestItem } from "@/app/quests/quest-status";

type QuestRowProps = {
  quest: QuestItem;
  // Shown in the circle on the left until the quest is done (e.g. 1, 2, 3).
  marker: ReactNode;
  onStart: (questId: number, actionUrl: string) => void;
  actionLabel?: string;
  // Something to do before the quest can start, e.g. "Connect X".
  blocker?: { label: string; onClick: () => void; disabled?: boolean };
  // Shown next to Claim, e.g. a link to where the task is done.
  secondary?: ReactNode;
  // Defaults: "Claim N XP" / "Completed". Campaign tasks say Verify.
  claimLabel?: string;
  doneLabel?: string;
};

// The main button keeps one width (about "Go to quest ↗") through Claim in Ns,
// Claim and Completed, so the row doesn't jump as the quest moves along.
const ACTION_WIDTH = "w-full md:w-auto md:min-w-32";

export const QuestRow = ({
  quest,
  marker,
  onStart,
  actionLabel = "Go to quest ↗",
  blocker,
  secondary,
  claimLabel,
  doneLabel = "Completed",
}: QuestRowProps) => {
  const [secondsLeft, setSecondsLeft] = useState(CLAIM_DELAY_S);
  const requireAuth = useRequireAuth();
  const claim = useClaimQuest();

  useEffect(() => {
    if (quest.status !== "started") return;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
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
          {isCompleted ? "✓" : marker}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-semibold text-white md:text-lg">
              {quest.title}
            </h3>
            {quest.points > 0 && (
              <Badge className="px-2 py-0.5 text-xs">+{quest.points} XP</Badge>
            )}
          </div>

          <p className="mt-1 text-sm leading-6 text-white/60">
            {quest.description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center">
        {quest.status === "idle" && blocker && (
          <Button
            onClick={blocker.onClick}
            disabled={blocker.disabled}
            className={ACTION_WIDTH}
          >
            {blocker.label}
          </Button>
        )}

        {quest.status === "idle" && !blocker && (
          <Button
            onClick={() => onStart(quest.id, quest.actionUrl)}
            className={ACTION_WIDTH}
          >
            {actionLabel}
          </Button>
        )}

        {quest.status === "started" && (
          <Button disabled className={`${ACTION_WIDTH} tabular-nums`}>
            {claimLabel ?? "Claim"} in {secondsLeft}s
          </Button>
        )}

        {quest.status === "claim_ready" && secondary}

        {quest.status === "claim_ready" && quest.claimable && (
          <Button
            variant="secondary"
            onClick={requireAuth(() =>
              claim.mutate({ questId: quest.id, title: quest.title }),
            )}
            disabled={claim.isPending}
            className={ACTION_WIDTH}
          >
            {claim.isPending
              ? "Checking…"
              : (claimLabel ?? `Claim ${quest.points} XP`)}
          </Button>
        )}

        {isCompleted && (
          <span
            className={`${ACTION_WIDTH} text-center text-sm font-semibold text-emerald-300`}
          >
            {doneLabel}
          </span>
        )}
      </div>
    </div>
  );
};
