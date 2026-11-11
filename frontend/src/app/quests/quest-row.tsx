import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon } from "@/shared/ui/icons";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { CopyIconSwap } from "@/shared/ui/copy-button";
import { useCopy } from "@/shared/ui/use-copy";
import { useRequireAuth } from "@/app/auth/use-require-auth";
import { useClaimQuest } from "@/app/quests/claims";
import { TagBadges } from "@/app/quests/tag-badges";
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
  // The claim needs a link from the user, e.g. their post on X: a field for
  // it shows next to Claim.
  proof?: { placeholder: string; label: string };
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
  proof,
}: QuestRowProps) => {
  const [secondsLeft, setSecondsLeft] = useState(CLAIM_DELAY_S);
  const [proofUrl, setProofUrl] = useState("");
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
          {isCompleted ? <CheckIcon /> : marker}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-semibold text-white md:text-lg">
              {quest.title}
            </h3>
            {quest.token && <CopyContract address={quest.token} />}
            {quest.points > 0 && (
              <Badge className="px-2 py-0.5 text-xs">+{quest.points} XP</Badge>
            )}
            {quest.optional && (
              <Badge variant="neutral" className="px-2 py-0.5 text-xs">
                Optional
              </Badge>
            )}
            {/* Only daily quests have tags; campaign tasks have none. */}
            <TagBadges tags={quest.tags} />
          </div>

          {/* break-words: long unbroken text (a wallet address) wraps
              instead of running out of the card. */}
          <p className="mt-1 text-sm leading-6 break-words text-white/60">
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

        {quest.status === "claim_ready" && quest.claimable && proof && (
          <input
            type="url"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder={proof.placeholder}
            aria-label={proof.label}
            className="w-full min-w-0 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-ink/60 focus:outline-none md:w-56"
          />
        )}

        {quest.status === "claim_ready" && quest.claimable && (
          <Button
            variant="secondary"
            onClick={requireAuth(() =>
              claim.mutate({
                questId: quest.id,
                title: quest.title,
                ...(proof && { proofUrl: proofUrl.trim() }),
              }),
            )}
            disabled={claim.isPending || (proof && !proofUrl.trim())}
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

// The token's contract, so it can be pasted into a DEX or wallet and the
// right token is bought (lookalikes share names, never addresses).
const CopyContract = ({ address }: { address: string }) => {
  const { copied, copy } = useCopy(address, "contract address");

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy contract ${address}`}
      aria-label={copied ? "Copied contract address" : "Copy contract address"}
      className="inline-flex cursor-pointer items-center rounded-full p-1 text-white/40 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-ink-light"
    >
      <CopyIconSwap copied={copied} className="h-3.5 w-3.5" />
    </button>
  );
};
