import type { ReactNode } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Button } from "@/shared/ui/button";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import { BoardTable } from "@/app/leaderboard/board-table";
import { PLACEHOLDER } from "@/app/leaderboard/podium";
import {
  useLeaderboard,
  useMyRank,
  type MyRank,
} from "@/app/leaderboard/use-leaderboard";

// The all-time board: the top 100 by total XP.
export const GlobalBoard = ({ tabs }: { tabs: ReactNode }) => {
  const { address } = useAuth();
  const leaderboard = useLeaderboard();
  const myRank = useMyRank();
  const entries = leaderboard.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {tabs}
      <LeaderboardIntro signedIn={Boolean(address)} myRank={myRank.data} />
      <Surface>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
              Global leaderboard
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Top 100 players ranked by total XP.
            </p>
          </div>

          <BoardTable
            rows={entries}
            me={
              address && myRank.data?.rank != null
                ? {
                    address,
                    name: myRank.data.name,
                    rank: myRank.data.rank,
                    xp: myRank.data.xp,
                  }
                : null
            }
            pending={leaderboard.isPending}
            error={leaderboard.isError ? () => leaderboard.refetch() : null}
            empty="No one on the board yet. Complete a quest or check in to be the first."
          />
        </div>
      </Surface>
    </div>
  );
};

type LeaderboardIntroProps = {
  signedIn: boolean;
  myRank: MyRank | undefined;
};

const LeaderboardIntro = ({ signedIn, myRank }: LeaderboardIntroProps) => {
  const { openConnectModal } = useConnectModal();

  if (!signedIn) {
    return (
      <PageIntro
        eyebrow="Leaderboard"
        title="Top players on Ink"
        description="Complete daily quests and check in every day to climb the leaderboard."
        aside={
          <Button onClick={openConnectModal} className="w-full md:w-auto">
            Connect wallet to see your rank
          </Button>
        }
      />
    );
  }

  if (myRank && myRank.rank === null) {
    return (
      <PageIntro
        eyebrow="Your position"
        title="You're not ranked yet"
        description="Complete a quest or check in to get on the board."
      />
    );
  }

  return (
    <PageIntro
      eyebrow="Your position"
      title={myRank ? `You are ranked #${myRank.rank}` : "Your position"}
      description="Keep completing daily quests to climb higher in the leaderboard."
      aside={
        <div className="grid grid-cols-2 gap-4 md:min-w-[420px]">
          <StatCard
            label="Total XP"
            value={myRank ? `${formatNumber(myRank.xp)} XP` : PLACEHOLDER}
          />
          <StatCard
            label="To next rank"
            value={
              myRank?.xpToNextRank != null
                ? `+${formatNumber(myRank.xpToNextRank)} XP`
                : PLACEHOLDER
            }
            hint={
              myRank &&
              (myRank.xpToNextRank === null
                ? "You're on top"
                : "to move up a place")
            }
          />
        </div>
      }
    />
  );
};
