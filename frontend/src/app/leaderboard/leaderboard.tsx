import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { isAddressEqual, type Address } from "viem";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { TabButton } from "@/shared/ui/tab-button";
import { ExternalLinkIcon, GiftIcon, XLogoIcon } from "@/shared/ui/icons";
import { formatNumber, shortAddress } from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import { connectX } from "@/app/x/use-x";
import {
  useChallenge,
  useLeaderboard,
  useMyChallenge,
  useMyRank,
  type Challenge,
  type MyChallenge,
  type MyRank,
} from "@/app/leaderboard/use-leaderboard";

const PODIUM_STYLES: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-300",
  2: "bg-slate-300/15 text-slate-200",
  3: "bg-orange-400/15 text-orange-300",
};

const PLACEHOLDER = "—";

type Board = "all" | "challenge";

// A row of either board.
type Row = {
  rank: number;
  address: Address;
  name: string | null;
  xp: number;
};

export const Leaderboard = () => {
  // Kept in the URL (?board=challenge) so it survives a reload and can be
  // shared.
  const [params, setParams] = useSearchParams();
  const board: Board =
    params.get("board") === "challenge" ? "challenge" : "all";
  const setBoard = (next: Board) =>
    setParams(next === "all" ? {} : { board: next }, { replace: true });

  const tabs = (
    <div
      role="tablist"
      aria-label="Leaderboards"
      className="flex w-fit gap-1 rounded-full border border-white/10 bg-black/20 p-1"
    >
      <TabButton
        selected={board === "all"}
        onClick={() => setBoard("all")}
        label="All time"
      />
      <TabButton
        selected={board === "challenge"}
        onClick={() => setBoard("challenge")}
        label="Weekly challenge"
      />
    </div>
  );

  return board === "all" ? (
    <GlobalBoard tabs={tabs} />
  ) : (
    <ChallengeBoard tabs={tabs} />
  );
};

// All time

const GlobalBoard = ({ tabs }: { tabs: ReactNode }) => {
  const { address } = useAuth();
  const leaderboard = useLeaderboard();
  const myRank = useMyRank();
  const entries = leaderboard.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <LeaderboardIntro signedIn={Boolean(address)} myRank={myRank.data} />
      {tabs}
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

// Weekly challenge

const ChallengeBoard = ({ tabs }: { tabs: ReactNode }) => {
  const { address } = useAuth();
  const overview = useChallenge();
  const mine = useMyChallenge();
  const challenge = overview.data?.challenge ?? null;
  const me = mine.data ?? null;

  return (
    <div className="flex flex-col gap-4">
      <ChallengeIntro
        challenge={challenge}
        loading={overview.isPending}
        signedIn={Boolean(address)}
        me={me}
      />
      {tabs}
      {challenge && (
        <Surface>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                {challenge.status === "ended" ? "Final standings" : "Standings"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                XP earned during the challenge.{" "}
                <GiftIcon className="inline h-3.5 w-3.5 text-amber-300" /> marks
                the prize places.
              </p>
            </div>

            <BoardTable
              rows={(overview.data?.top ?? []).map((e) => ({
                ...e,
                xp: e.score,
              }))}
              me={
                address && me?.rank != null
                  ? { address, name: me.name, rank: me.rank, xp: me.score }
                  : null
              }
              places={challenge.places}
              prize={challenge.prize}
              pending={overview.isPending}
              error={overview.isError ? () => overview.refetch() : null}
              empty={
                challenge.status === "upcoming"
                  ? "The challenge hasn't started yet."
                  : "No one has scored yet. Complete a daily quest or check in to be the first."
              }
            />
          </div>
        </Surface>
      )}
    </div>
  );
};

type ChallengeIntroProps = {
  challenge: Challenge | null;
  loading: boolean;
  signedIn: boolean;
  me: MyChallenge | null;
};

const ChallengeIntro = ({
  challenge,
  loading,
  signedIn,
  me,
}: ChallengeIntroProps) => {
  const { openConnectModal } = useConnectModal();
  const now = useNow();

  if (loading) {
    return <PageIntro eyebrow="Weekly challenge" title="Weekly challenge" />;
  }
  if (!challenge) {
    return (
      <PageIntro
        eyebrow="Weekly challenge"
        title="No challenge right now"
        description="The next weekly challenge is on its way. Follow @inkquests on X to hear when it starts."
      />
    );
  }

  const when =
    challenge.status === "live"
      ? `Ends in ${countdown(challenge.endsAt, now)}`
      : challenge.status === "upcoming"
        ? `Starts in ${countdown(challenge.startsAt, now)}`
        : "Ended";

  let aside: ReactNode = null;
  if (!signedIn) {
    aside = (
      <Button onClick={openConnectModal} className="w-full md:w-auto">
        Connect wallet to take part
      </Button>
    );
  } else if (me && !me.eligible) {
    aside = (
      <div className="flex flex-col gap-3 rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-4 md:max-w-72">
        <p className="text-sm leading-6 text-white/70">
          Connect your X account to take part. Until then your XP doesn't count
          in the challenge.
        </p>
        <Button onClick={connectX} className="w-full">
          <XLogoIcon className="h-4 w-4" />
          Connect X
        </Button>
      </div>
    );
  } else if (me) {
    aside = (
      <div className="grid grid-cols-2 gap-4 md:min-w-[420px]">
        <StatCard
          label="Your place"
          value={me.rank != null ? `#${me.rank}` : PLACEHOLDER}
          hint={
            me.rank != null && me.rank <= challenge.places
              ? "in the prize places"
              : undefined
          }
        />
        <StatCard
          label="Challenge XP"
          value={`${formatNumber(me.score)} XP`}
          hint={`${me.referralsCounted}/${challenge.referralLimit} referrals counted`}
        />
      </div>
    );
  }

  return (
    <PageIntro
      eyebrow={`Weekly challenge · ${when}`}
      title={challenge.title}
      description={
        <>
          {formatUtcRange(challenge.startsAt, challenge.endsAt)}. The top{" "}
          {challenge.places} players each win {challenge.prize}.
          {challenge.postUrl && (
            <>
              {" "}
              <a
                href={challenge.postUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-ink-light transition hover:text-white"
              >
                Details
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </>
      }
      aside={aside}
    >
      <ul className="grid gap-2 text-sm leading-6 text-white/60 sm:grid-cols-2">
        <Rule>Daily quests, check-ins and like &amp; repost count.</Rule>
        <Rule>
          Up to {challenge.referralLimit} friends you invite during the
          challenge count.
        </Rule>
        <Rule>Partner quests don't count.</Rule>
        {challenge.xRequired && (
          <Rule>A connected X account is required to take part.</Rule>
        )}
      </ul>
    </PageIntro>
  );
};

const Rule = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-2">
    <span aria-hidden className="text-ink-light">
      •
    </span>
    {children}
  </li>
);

// The current time, refreshed every minute for countdowns.
const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
};

// "2d 5h", "3h 12m" or "12m" until `iso`.
const countdown = (iso: string, now: number) => {
  const minutes = Math.max(0, Math.ceil((Date.parse(iso) - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

// "Oct 26 – Nov 1 (UTC)": the challenge's first and last UTC day; endsAt
// itself is the moment it closes, so the last day is the one before.
const formatUtcRange = (startsAt: string, endsAt: string) => {
  const day = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    });
  return `${day(Date.parse(startsAt))} – ${day(Date.parse(endsAt) - 1)} (UTC)`;
};

// Shared table

type BoardTableProps = {
  rows: Row[];
  // The signed-in player, added below the list when ranked outside it.
  me: Row | null;
  // Prize places, marked with a gift.
  places?: number;
  prize?: string;
  pending: boolean;
  error: (() => void) | null;
  empty: string;
};

const BoardTable = ({
  rows,
  me,
  places = 0,
  prize,
  pending,
  error,
  empty,
}: BoardTableProps) => {
  const { address } = useAuth();
  const isMe = (entry: Address) =>
    Boolean(address && isAddressEqual(entry, address));
  // Ranked, but below the listed top: shown as an extra row at the end.
  const myRowBelow =
    me &&
    !pending &&
    me.rank > (rows.at(-1)?.rank ?? 0) &&
    !rows.some((r) => isMe(r.address))
      ? me
      : null;
  const prizeFor = (rank: number) => (prize && rank <= places ? prize : null);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
      <div className="grid grid-cols-[56px_1fr_auto] gap-4 border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-wide text-white/40 md:grid-cols-[80px_1fr_auto]">
        <span>Rank</span>
        <span>Player</span>
        <span className="text-right">XP</span>
      </div>

      <div className="flex flex-col">
        {pending &&
          Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="h-[53px] animate-pulse border-b border-white/10 bg-white/[0.02] last:border-b-0"
            />
          ))}

        {error && (
          <p className="px-4 py-6 text-center text-sm text-white/60">
            Couldn't load the leaderboard.{" "}
            <button
              type="button"
              onClick={error}
              className="cursor-pointer font-semibold text-ink-light hover:text-white"
            >
              Try again
            </button>
          </p>
        )}

        {!pending && !error && rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-white/60">{empty}</p>
        )}

        {rows.map((row) => (
          <LeaderboardRow
            key={row.address}
            {...row}
            prize={prizeFor(row.rank)}
            isCurrentUser={isMe(row.address)}
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
            <LeaderboardRow
              {...myRowBelow}
              prize={prizeFor(myRowBelow.rank)}
              isCurrentUser
            />
          </>
        )}
      </div>
    </div>
  );
};

type LeaderboardRowProps = Row & {
  prize: string | null;
  isCurrentUser: boolean;
};

const LeaderboardRow = ({
  rank,
  address,
  name,
  xp,
  prize,
  isCurrentUser,
}: LeaderboardRowProps) => (
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
