import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { formatNumber } from "@/lib/format";

type LeaderboardUser = {
  id: number;
  wallet: string;
  xp: number;
};

const leaderboardData: LeaderboardUser[] = [
  { id: 1, wallet: "0x71a2...1f92", xp: 5820 },
  { id: 2, wallet: "0x93bc...73ad", xp: 5410 },
  { id: 3, wallet: "0x2fa1...98ce", xp: 4980 },
  { id: 4, wallet: "0x8de4...12aa", xp: 4720 },
  { id: 5, wallet: "0x41cc...8be1", xp: 4510 },
  { id: 6, wallet: "0x1234...abcd", xp: 1240 },
  { id: 7, wallet: "0xf12a...77ce", xp: 1190 },
  { id: 8, wallet: "0x76da...91ef", xp: 980 },
  { id: 9, wallet: "0x55aa...12fe", xp: 920 },
  { id: 10, wallet: "0xb82c...4d11", xp: 850 },
];

const currentUserWallet = "0x1234...abcd";

const PODIUM_STYLES: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-300",
  2: "bg-slate-300/15 text-slate-200",
  3: "bg-orange-400/15 text-orange-300",
};

export const Leaderboard = () => {
  const sortedLeaderboard = [...leaderboardData].sort((a, b) => b.xp - a.xp);

  const currentUserIndex = sortedLeaderboard.findIndex(
    (user) => user.wallet === currentUserWallet,
  );

  const currentUser = sortedLeaderboard[currentUserIndex];
  const currentUserRank = currentUserIndex + 1;
  const userAbove = sortedLeaderboard[currentUserIndex - 1];
  const xpToNextRank = userAbove ? userAbove.xp - currentUser.xp + 1 : 0;

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Your position"
        title={`You are ranked #${currentUserRank}`}
        description="Keep completing daily quests to climb higher in the leaderboard."
        aside={
          <div className="grid grid-cols-2 gap-4 md:min-w-[420px]">
            <StatCard
              label="Total XP"
              value={`${formatNumber(currentUser.xp)} XP`}
            />
            <StatCard
              label="To next rank"
              value={userAbove ? `+${formatNumber(xpToNextRank)} XP` : "—"}
              hint={
                userAbove ? `to pass #${currentUserRank - 1}` : "You're on top"
              }
            />
          </div>
        }
      />

      <Surface>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
              Global leaderboard
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Top players ranked by total XP.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
            <div className="grid grid-cols-[56px_1fr_auto] gap-4 border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-wide text-white/40 md:grid-cols-[80px_1fr_auto]">
              <span>Rank</span>
              <span>Wallet</span>
              <span className="text-right">XP</span>
            </div>

            <div className="flex flex-col">
              {sortedLeaderboard.map((user, index) => {
                const rank = index + 1;
                const isCurrentUser = user.wallet === currentUserWallet;

                return (
                  <div
                    key={user.id}
                    className={`grid grid-cols-[56px_1fr_auto] items-center gap-4 border-b border-white/10 px-4 py-3.5 transition last:border-b-0 md:grid-cols-[80px_1fr_auto] ${
                      isCurrentUser ? "bg-ink/10" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`inline-flex w-11 items-center justify-center rounded-full py-1 text-sm font-semibold tabular-nums ${
                        isCurrentUser
                          ? "bg-ink text-white"
                          : (PODIUM_STYLES[rank] ?? "bg-white/5 text-white/70")
                      }`}
                    >
                      {rank}
                    </span>

                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`truncate font-mono text-sm ${isCurrentUser ? "text-white" : "text-white/55"}`}
                      >
                        {user.wallet}
                      </span>
                      {isCurrentUser && (
                        <span className="hidden sm:block">
                          <Badge className="px-2 py-0.5 text-xs">You</Badge>
                        </span>
                      )}
                    </span>

                    <span className="text-right text-sm font-semibold text-white tabular-nums md:text-base">
                      {formatNumber(user.xp)} XP
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
};
