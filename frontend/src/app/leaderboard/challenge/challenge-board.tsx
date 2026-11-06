import type { ReactNode } from "react";
import { PageIntro } from "@/shared/ui/page-intro";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { useAuth } from "@/app/auth/use-auth";
import {
  useChallenge,
  useMyChallenge,
} from "@/app/leaderboard/use-leaderboard";
import { ChallengeHeader } from "@/app/leaderboard/challenge/challenge-header";
import { ChallengeStandings } from "@/app/leaderboard/challenge/challenge-standings";
import { PrizesCard } from "@/app/leaderboard/challenge/prizes-card";
import { RulesCard } from "@/app/leaderboard/challenge/rules-card";
import { YourProgressCard } from "@/app/leaderboard/challenge/your-progress-card";

// The challenge: header, prizes and the player's progress side by
// side, the rules, then the standings.
export const ChallengeBoard = ({ tabs }: { tabs: ReactNode }) => {
  const { address, status } = useAuth();
  const overview = useChallenge();
  const mine = useMyChallenge();
  const challenge = overview.data?.challenge ?? null;
  // TEMP preview: treat the signed-in wallet as having X connected. Revert
  // before committing.
  const me = mine.data ? { ...mine.data, eligible: true, xLinked: true } : null;

  // The page's own layout in skeletons: header, prizes and progress, rules,
  // standings.
  if (overview.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <CardSkeleton className="h-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton className="h-64" />
          <CardSkeleton className="h-64" />
        </div>
        <CardSkeleton className="h-40" />
        <CardSkeleton className="h-96" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <PageIntro
          eyebrow="Challenges"
          title="No challenge right now"
          description="The next challenge is on its way. Follow @inkquests on X to hear when it starts."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tabs}
      <ChallengeHeader challenge={challenge} />

      <div className="grid gap-4 md:grid-cols-2">
        <PrizesCard challenge={challenge} />
        <YourProgressCard
          challenge={challenge}
          signedIn={Boolean(address)}
          loading={status === "loading" || (Boolean(address) && mine.isPending)}
          me={me}
        />
      </div>

      <RulesCard challenge={challenge} />

      <ChallengeStandings
        challenge={challenge}
        top={overview.data?.top ?? []}
        me={me}
        onRetry={overview.isError ? () => overview.refetch() : null}
      />
    </div>
  );
};
