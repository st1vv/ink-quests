import { Surface } from "@/shared/ui/surface";

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

export const Leaderboard = () => {
  const sortedLeaderboard = [...leaderboardData].sort((a, b) => b.xp - a.xp);

  const currentUserIndex = sortedLeaderboard.findIndex(
    (user) => user.wallet === currentUserWallet,
  );

  const currentUser = sortedLeaderboard[currentUserIndex];
  const currentUserRank = currentUserIndex + 1;

  return (
    <div className="flex flex-col gap-4">
      <Surface className="w-full max-w-full">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-white/50">Your position</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              You are ranked #{currentUserRank}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Keep completing daily quests to climb higher in the leaderboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:min-w-[420px]">
            <UserStatCard label="Rank" value={`#${currentUserRank}`} />
            <UserStatCard label="XP" value={`${currentUser.xp}`} />
          </div>
        </div>
      </Surface>

      <Surface className="w-full max-w-full">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                Global leaderboard
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Top players ranked by total XP.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
            <div className="grid grid-cols-[80px_1.4fr_1fr] gap-4 border-b border-white/10 px-4 py-4 text-sm font-medium text-white/45">
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
                    className={`grid grid-cols-[80px_1.4fr_1fr] gap-4 border-b border-white/10 px-4 py-4 last:border-b-0 ${
                      isCurrentUser ? "bg-[#7132f5]/10" : ""
                    }`}
                  >
                    <div className="flex items-center">
                      <span
                        className={`inline-flex min-w-[44px] items-center justify-center rounded-full px-3 py-1 text-sm font-semibold ${
                          isCurrentUser
                            ? "bg-[#7132f5] text-white"
                            : "bg-white/5 text-white/80"
                        }`}
                      >
                        #{rank}
                      </span>
                    </div>

                    <div className="flex items-center">
                      <span className="truncate text-sm text-white/55">
                        {user.wallet}
                      </span>
                    </div>

                    <div className="flex items-center justify-end">
                      <span className="text-sm font-semibold text-white md:text-base">
                        {user.xp} XP
                      </span>
                    </div>
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

type UserStatCardProps = {
  label: string;
  value: string;
};

const UserStatCard = ({ label, value }: UserStatCardProps) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
};
