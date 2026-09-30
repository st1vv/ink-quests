import { useState } from "react";
import type { Quest } from "@/app/quests/catalog";

// Completed comes from the server; the rest is the in-page flow of opening
// the quest and waiting a moment before the claim button appears.
export type QuestStatus = "idle" | "started" | "claim_ready" | "completed";

export type QuestItem = Quest & { status: QuestStatus };

export const CLAIM_DELAY_S = 5;

// Quest list state: completed from the server, started/claim-ready while
// the user is on the page.
export const useQuestStatuses = (
  quests: Quest[] | undefined,
  completed: Set<number> | undefined,
  // Quests checked on claim (e.g. holding an NFT): no "go and wait" step.
  claimableNow?: (quest: Quest) => boolean,
) => {
  const [statuses, setStatuses] = useState<Record<number, QuestStatus>>({});

  const items: QuestItem[] = (quests ?? []).map((quest) => ({
    ...quest,
    status: completed?.has(quest.id)
      ? "completed"
      : (statuses[quest.id] ??
        (claimableNow?.(quest) ? "claim_ready" : "idle")),
  }));

  const start = (questId: number, actionUrl: string) => {
    window.open(actionUrl, "_blank", "noopener,noreferrer");
    setStatuses((prev) => ({ ...prev, [questId]: "started" }));

    window.setTimeout(() => {
      setStatuses((prev) =>
        prev[questId] === "started"
          ? { ...prev, [questId]: "claim_ready" }
          : prev,
      );
    }, CLAIM_DELAY_S * 1000);
  };

  return { items, start };
};
