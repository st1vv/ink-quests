import type { ReactNode } from "react";
import { PageIntro } from "@/shared/ui/page-intro";
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

// The weekly challenge: header, prizes and the player's progress side by
// side, the rules, then the standings.
export const ChallengeBoard = ({ tabs }: { tabs: ReactNode }) => {
  const { address } = useAuth();
  const overview = useChallenge();
  const mine = useMyChallenge();
  const challenge = overview.data?.challenge ?? null;
  const me = mine.data ?? null;

  if (overview.isPending || !challenge) {
    return (
      <div className="flex flex-col gap-4">
        {tabs}
        <PageIntro
          eyebrow="Weekly challenge"
          title={
            overview.isPending ? "Weekly challenge" : "No challenge right now"
          }
          description={
            overview.isPending
              ? undefined
              : "The next weekly challenge is on its way. Follow @inkquests on X to hear when it starts."
          }
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
