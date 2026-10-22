import { Surface } from "@/shared/ui/surface";
import { useAuth } from "@/app/auth/use-auth";
import { BoardTable } from "@/app/leaderboard/board-table";
import type {
  Challenge,
  ChallengeEntry,
  MyChallenge,
} from "@/app/leaderboard/use-leaderboard";

type ChallengeStandingsProps = {
  challenge: Challenge;
  top: ChallengeEntry[];
  me: MyChallenge | null;
  // Retries loading, when it failed.
  onRetry: (() => void) | null;
};

// The challenge's own ranking, by XP earned during it.
export const ChallengeStandings = ({
  challenge,
  top,
  me,
  onRetry,
}: ChallengeStandingsProps) => {
  const { address } = useAuth();

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            {challenge.status === "ended" ? "Final standings" : "Standings"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            XP earned during the challenge.
          </p>
        </div>

        <BoardTable
          rows={top.map((e) => ({ ...e, xp: e.score }))}
          me={
            address && me?.rank != null
              ? { address, name: me.name, rank: me.rank, xp: me.score }
              : null
          }
          places={challenge.places}
          prize={challenge.prize}
          pending={false}
          error={onRetry}
          empty={
            challenge.status === "upcoming"
              ? "The challenge hasn't started yet."
              : "No one has scored yet. Complete a daily quest or check in to be the first."
          }
        />
      </div>
    </Surface>
  );
};
