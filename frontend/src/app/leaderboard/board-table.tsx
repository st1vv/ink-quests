import { isAddressEqual, type Address } from "viem";
import { Badge } from "@/shared/ui/badge";
import { GiftIcon } from "@/shared/ui/icons";
import { formatNumber, shortAddress } from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import { PODIUM_STYLES } from "@/app/leaderboard/podium";

// A row of either board.
export type Row = {
  rank: number;
  address: Address;
  name: string | null;
  xp: number;
};

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

// The ranking table shared by the all-time board and the challenge.
export const BoardTable = ({
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
