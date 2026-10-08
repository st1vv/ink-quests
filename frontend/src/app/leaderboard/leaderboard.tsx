import { useConnectModal } from "@rainbow-me/rainbowkit";
import { isAddressEqual, type Address } from "viem";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { buttonStyles } from "@/shared/ui/button-styles";
import { ExternalLinkIcon, GiftIcon, XLogoIcon } from "@/shared/ui/icons";
import { formatNumber, shortAddress } from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import {
  useLeaderboard,
  useMyRank,
  type MyRank,
} from "@/app/leaderboard/use-leaderboard";

const PODIUM_STYLES: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-300",
  2: "bg-slate-300/15 text-slate-200",
  3: "bg-orange-400/15 text-orange-300",
};

// The current challenge: its top places win the prize. Set to null once
// it's over to hide the note and the badges.
const CHALLENGE: { places: number; prize: string; postUrl: string } | null = {
  places: 3,
  prize: "1 Ink Hornet NFT",
  postUrl: "https://x.com/inkquests/status/2108118410152268029",
};

const prizeFor = (rank: number) =>
  CHALLENGE && rank <= CHALLENGE.places ? CHALLENGE.prize : null;

export const Leaderboard = () => {
  const { address } = useAuth();
  const leaderboard = useLeaderboard();
  const myRank = useMyRank();

  const entries = leaderboard.data ?? [];
  const isMe = (entry: Address) =>
    Boolean(address && isAddressEqual(entry, address));
  // Ranked, but below the listed top: shown as an extra row at the end.
  const myRowBelow =
    address &&
    leaderboard.isSuccess &&
    myRank.data?.rank != null &&
    myRank.data.rank > (entries.at(-1)?.rank ?? 0) &&
    !entries.some((e) => isMe(e.address))
      ? {
          address,
          name: myRank.data.name,
          rank: myRank.data.rank,
          xp: myRank.data.xp,
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
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

          {CHALLENGE && <ChallengeNote challenge={CHALLENGE} />}

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
            <div className="grid grid-cols-[56px_1fr_auto] gap-4 border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-wide text-white/40 md:grid-cols-[80px_1fr_auto]">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-right">XP</span>
            </div>

            <div className="flex flex-col">
              {leaderboard.isPending &&
                Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="h-[53px] animate-pulse border-b border-white/10 bg-white/[0.02] last:border-b-0"
                  />
                ))}

              {leaderboard.isError && (
                <p className="px-4 py-6 text-center text-sm text-white/60">
                  Couldn't load the leaderboard.{" "}
                  <button
                    type="button"
                    onClick={() => leaderboard.refetch()}
                    className="cursor-pointer font-semibold text-ink-light hover:text-white"
                  >
                    Try again
                  </button>
                </p>
              )}

              {leaderboard.isSuccess && entries.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-white/60">
                  No one on the board yet. Complete a quest or check in to be
                  the first.
                </p>
              )}

              {entries.map((entry) => (
                <LeaderboardRow
                  key={entry.address}
                  rank={entry.rank}
                  address={entry.address}
                  name={entry.name}
                  xp={entry.xp}
                  isCurrentUser={isMe(entry.address)}
                />
              ))}

              {myRowBelow && (
                <>
                  <div
                    aria-hidden
                    className="border-b border-white/10 py-1 text-center text-white/30"
                  >
                    ⋯
                  </div>
                  <LeaderboardRow {...myRowBelow} isCurrentUser />
                </>
              )}
            </div>
          </div>
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
            value={myRank ? `${formatNumber(myRank.xp)} XP` : "—"}
          />
          <StatCard
            label="To next rank"
            value={
              myRank?.xpToNextRank != null
                ? `+${formatNumber(myRank.xpToNextRank)} XP`
                : "—"
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

type ChallengeNoteProps = { challenge: NonNullable<typeof CHALLENGE> };

const ChallengeNote = ({ challenge }: ChallengeNoteProps) => (
  <div className="flex flex-col gap-3 rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-center">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
      <GiftIcon className="h-5 w-5" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-white">Weekly challenge</p>
      <p className="mt-0.5 text-sm leading-6 text-white/60">
        The top {challenge.places} players each win {challenge.prize}.
      </p>
    </div>
    <a
      href={challenge.postUrl}
      target="_blank"
      rel="noreferrer"
      className={buttonStyles({
        variant: "ghost",
        className: "w-full shrink-0 sm:w-auto",
      })}
    >
      <XLogoIcon className="h-3.5 w-3.5" />
      Details
      <ExternalLinkIcon className="h-3.5 w-3.5 text-white/50" />
    </a>
  </div>
);

type LeaderboardRowProps = {
  rank: number;
  address: string;
  name: string | null;
  xp: number;
  isCurrentUser: boolean;
};

const LeaderboardRow = ({
  rank,
  address,
  name,
  xp,
  isCurrentUser,
}: LeaderboardRowProps) => {
  const prize = prizeFor(rank);

  return (
    <div
      className={`grid grid-cols-[56px_1fr_auto] items-center gap-4 border-b border-white/10 px-4 py-3.5 transition last:border-b-0 md:grid-cols-[80px_1fr_auto] ${
        isCurrentUser ? "bg-ink/10" : "hover:bg-white/[0.03]"
      }`}
    >
      <span
        className={`inline-flex min-w-11 items-center justify-center rounded-full px-2 py-1 text-sm font-semibold tabular-nums ${
          isCurrentUser
            ? "bg-ink text-white"
            : (PODIUM_STYLES[rank] ?? "bg-white/5 text-white/70")
        }`}
      >
        {rank}
      </span>

      <span className="flex min-w-0 items-center gap-2">
        {/* The name replaces the address; hovering still shows the wallet. */}
        <span
          title={address}
          className={`truncate text-sm ${name ? "font-semibold" : "font-mono"} ${isCurrentUser ? "text-white" : name ? "text-white/85" : "text-white/55"}`}
        >
          {name ?? shortAddress(address)}
        </span>
        {isCurrentUser && (
          <span className="hidden sm:block">
            <Badge className="px-2 py-0.5 text-xs">You</Badge>
          </span>
        )}
        {prize && (
          <span
            role="img"
            aria-label={`Wins ${prize}`}
            title={`Wins ${prize}`}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300"
          >
            <GiftIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </span>

      <span className="text-right text-sm font-semibold text-white tabular-nums md:text-base">
        {formatNumber(xp)} XP
      </span>
    </div>
  );
};
