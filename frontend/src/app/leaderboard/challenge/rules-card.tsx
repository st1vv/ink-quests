import type { ReactNode } from "react";
import { Surface } from "@/shared/ui/surface";
import { CheckIcon, CloseIcon } from "@/shared/ui/icons";
import { CardTitle } from "@/app/leaderboard/challenge/card-title";
import type { Challenge } from "@/app/leaderboard/use-leaderboard";

// What counts and what doesn't.
export const RulesCard = ({ challenge }: { challenge: Challenge }) => (
  <Surface>
    <div className="flex flex-col gap-4">
      <CardTitle>How it works</CardTitle>
      <ul className="grid gap-x-6 gap-y-2.5 text-sm leading-6 text-white/70 sm:grid-cols-2">
        <Rule counts>Daily quests</Rule>
        <Rule counts>Daily check-ins</Rule>
        <Rule counts>Daily like &amp; repost on X</Rule>
        <Rule counts>
          Up to {challenge.referralLimit} friends you invite during the
          challenge
        </Rule>
        <Rule counts={false}>Partner quests</Rule>
        {challenge.xRequired && (
          <Rule counts>A connected X account is required to take part</Rule>
        )}
      </ul>
      <p className="text-xs text-white/40">
        On equal XP, whoever got there first ranks higher.
      </p>
    </div>
  </Surface>
);

const Rule = ({
  counts,
  children,
}: {
  counts: boolean;
  children: ReactNode;
}) => (
  <li className="flex items-start gap-2.5">
    <span
      aria-label={counts ? "Counts" : "Doesn't count"}
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
        counts
          ? "bg-emerald-400/15 text-emerald-300"
          : "bg-white/5 text-white/40"
      }`}
    >
      {counts ? (
        <CheckIcon className="h-3 w-3" />
      ) : (
        <CloseIcon className="h-3 w-3" />
      )}
    </span>
    {children}
  </li>
);
