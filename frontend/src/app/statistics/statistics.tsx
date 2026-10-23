import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import type { Address } from "viem";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { buttonStyles } from "@/shared/ui/button-styles";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { formatDateTime, formatNumber, shortAddress } from "@/lib/format";
import { EXPLORER_TX_URL } from "@/lib/explorer";
import { useAuth } from "@/app/auth/use-auth";
import { NotFound } from "@/app/not-found/not-found";
import {
  isNotFound,
  useStatsList,
  useStatsSummary,
  type StatsCheckIn,
  type StatsCompletion,
  type StatsRankedUser,
  type StatsSummary,
  type StatsTransactionWallet,
  type StatsUser,
  type StatsView,
} from "@/app/statistics/use-statistics";

const PLACEHOLDER = "—";
const DEFAULT_VIEW: StatsView = "transactions";

// The stat cards, in order, and the list each one opens below.
const CARDS: {
  view: StatsView;
  label: string;
  value: (s: StatsSummary) => number;
  hint?: (s: StatsSummary) => string | undefined;
}[] = [
  { view: "users", label: "Users", value: (s) => s.users },
  {
    view: "users-with-xp",
    label: "Users with XP",
    value: (s) => s.usersWithXp,
    hint: (s) =>
      s.users > 0
        ? `${Math.round((s.usersWithXp / s.users) * 100)}% of users`
        : undefined,
  },
  {
    view: "quests",
    label: "Quests completed",
    value: (s) => s.questsCompleted,
    hint: () => "daily + partner",
  },
  {
    view: "daily-quests",
    label: "Daily quests",
    value: (s) => s.dailyQuestsCompleted,
  },
  {
    view: "partner-quests",
    label: "Partner quests",
    value: (s) => s.partnerQuestsCompleted,
    hint: () => "every task done",
  },
  { view: "check-ins", label: "Check-ins", value: (s) => s.checkIns },
  {
    view: "transactions",
    label: "Transactions",
    value: (s) => s.transactions,
    hint: () => "quests proven onchain",
  },
  {
    view: "transaction-wallets",
    label: "Wallets with transactions",
    value: (s) => s.transactionUsers,
  },
];

const isView = (value: string | null): value is StatsView =>
  CARDS.some((c) => c.view === value);

// The list, page and wallet filter live in the URL (?view=users&page=2&
// address=0x…), so a reload or a shared link shows the same table.
const useListParams = () => {
  const [params, setParams] = useSearchParams();
  const rawView = params.get("view");
  const view = isView(rawView) ? rawView : DEFAULT_VIEW;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filter = params.get("address");

  // A new list or filter starts on page 1; the filter carries over to
  // another list, so one wallet can be followed across them.
  const go = (next: {
    view?: StatsView;
    page?: number;
    address?: string | null;
  }) => {
    const search = new URLSearchParams(params);
    if (next.view !== undefined) {
      if (next.view === DEFAULT_VIEW) search.delete("view");
      else search.set("view", next.view);
    }
    const nextPage = next.page ?? 1;
    if (nextPage > 1) search.set("page", String(nextPage));
    else search.delete("page");
    if (next.address !== undefined) {
      if (next.address) search.set("address", next.address);
      else search.delete("address");
    }
    setParams(search);
  };

  return { view, page, filter, go };
};

// Owner-only stats. Not linked anywhere; the backend decides who sees data.
// Until it confirms an admin wallet the page looks like any missing page,
// so visitors can't tell it exists. Admins sign in with the header button.
export const Statistics = () => {
  const { address, status } = useAuth();
  const stats = useStatsSummary();
  const list = useListParams();

  if (status === "loading" || (address && stats.isPending)) return null;
  if (!address || isNotFound(stats.error)) return <NotFound />;

  return (
    <div className="flex flex-col gap-4">
      <StatsOverview
        stats={stats.data}
        onRetry={stats.isError ? () => stats.refetch() : undefined}
        view={list.view}
        onSelect={(view) => list.go({ view })}
      />
      <StatsList {...list} />
    </div>
  );
};

type StatsOverviewProps = {
  stats: StatsSummary | undefined;
  onRetry?: () => void;
  view: StatsView;
  onSelect: (view: StatsView) => void;
};

const StatsOverview = ({
  stats,
  onRetry,
  view,
  onSelect,
}: StatsOverviewProps) => (
  <PageIntro
    eyebrow="Overview"
    title="Statistics"
    description={
      onRetry ? (
        <>
          Couldn't load the stats.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer font-semibold text-ink-light hover:text-white"
          >
            Try again
          </button>
        </>
      ) : (
        "Users, quests and onchain transactions across the whole app. Pick a card to list what it counts."
      )
    }
    aside={
      <Link
        to="/statistics/posts"
        className={buttonStyles({
          variant: "ghost",
          className: "w-full md:w-auto",
        })}
      >
        Posts of the day →
      </Link>
    }
  >
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => (
        <StatCard
          key={card.view}
          label={card.label}
          value={stats ? formatNumber(card.value(stats)) : PLACEHOLDER}
          hint={stats && card.hint?.(stats)}
          selected={view === card.view}
          onClick={() => onSelect(card.view)}
        />
      ))}
    </div>
  </PageIntro>
);

type ListProps = ReturnType<typeof useListParams>;

// Each list with its own columns. Grid templates are spelled out in full so
// Tailwind sees them.
const StatsList = (props: ListProps) => {
  switch (props.view) {
    case "users":
      return (
        <StatsTable<StatsUser>
          {...props}
          title="Users"
          description="Every wallet that signed in, newest first."
          empty="No users yet."
          grid="md:grid-cols-[170px_110px_110px_140px_1fr_1fr_150px]"
          columns={USER_COLUMNS}
        />
      );
    case "users-with-xp":
      return (
        <StatsTable<StatsRankedUser>
          {...props}
          title="Users with XP"
          description="Every wallet with XP by rank, our own included."
          empty="Nobody has XP yet."
          grid="md:grid-cols-[60px_1fr_110px_110px_140px_170px]"
          columns={RANKED_USER_COLUMNS}
        />
      );
    case "quests":
      return (
        <StatsTable<StatsCompletion>
          {...props}
          title="Quests completed"
          description="Daily quests and finished partner quests, newest first."
          empty="No quests completed yet."
          grid={COMPLETION_GRID}
          columns={COMPLETION_COLUMNS}
        />
      );
    case "daily-quests":
      return (
        <StatsTable<StatsCompletion>
          {...props}
          title="Daily quests"
          description="Daily quest completions, newest first."
          empty="No daily quests completed yet."
          grid={COMPLETION_GRID}
          columns={COMPLETION_COLUMNS}
        />
      );
    case "partner-quests":
      return (
        <StatsTable<StatsCompletion>
          {...props}
          title="Partner quests"
          description="Partner quests with every task done and the reward claimed, newest first."
          empty="No partner quests completed yet."
          grid={COMPLETION_GRID}
          columns={COMPLETION_COLUMNS}
        />
      );
    case "check-ins":
      return (
        <StatsTable<StatsCheckIn>
          {...props}
          title="Check-ins"
          description="Daily check-ins, newest first."
          empty="No check-ins yet."
          grid="md:grid-cols-[150px_130px_1fr_120px_170px]"
          columns={CHECK_IN_COLUMNS}
        />
      );
    case "transactions":
      return (
        <StatsTable<StatsCompletion>
          {...props}
          title="Transactions"
          description="Quests completed with an onchain transaction, newest first."
          empty="No transactions yet."
          grid={COMPLETION_GRID}
          columns={TRANSACTION_COLUMNS}
        />
      );
    case "transaction-wallets":
      return (
        <StatsTable<StatsTransactionWallet>
          {...props}
          title="Wallets with transactions"
          description="Wallets with at least one quest proven onchain, latest first."
          empty="No wallets with transactions yet."
          grid="md:grid-cols-[1fr_130px_120px_100px_170px]"
          columns={TRANSACTION_WALLET_COLUMNS}
        />
      );
  }
};

type Column<T> = {
  label: string;
  align?: "right";
  cell: (item: T, filterBy: (address: Address) => void) => ReactNode;
};

type StatsTableProps<T> = ListProps & {
  title: string;
  description: string;
  empty: string;
  // md:grid-cols-[…], one track per column.
  grid: string;
  columns: Column<T>[];
};

const StatsTable = <T extends { id: number | string }>({
  view,
  page,
  filter,
  go,
  title,
  description,
  empty,
  grid,
  columns,
}: StatsTableProps<T>) => {
  const list = useStatsList<T>(view, page, filter);
  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filterBy = (address: Address) => go({ address });

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {description}
              {data && ` ${formatNumber(data.total)} in total.`}
            </p>
          </div>

          {filter && (
            <div className="flex items-center gap-2">
              <Badge className="px-3 py-1 font-mono text-xs">
                {shortAddress(filter)}
              </Badge>
              <Button variant="ghost" onClick={() => go({ address: null })}>
                Show all wallets
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
          <div
            className={`hidden gap-4 border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-wide text-white/40 md:grid ${grid}`}
          >
            {columns.map((c) => (
              <span
                key={c.label}
                className={c.align === "right" ? "text-right" : ""}
              >
                {c.label}
              </span>
            ))}
          </div>

          <div
            className={`flex flex-col transition-opacity ${list.isPlaceholderData ? "opacity-50" : ""}`}
          >
            {list.isPending &&
              Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-[61px] animate-pulse border-b border-white/10 bg-white/[0.02] last:border-b-0"
                />
              ))}

            {list.isError && (
              <p className="px-4 py-6 text-center text-sm text-white/60">
                Couldn't load the list.{" "}
                <button
                  type="button"
                  onClick={() => list.refetch()}
                  className="cursor-pointer font-semibold text-ink-light hover:text-white"
                >
                  Try again
                </button>
              </p>
            )}

            {data?.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-white/60">
                {empty}
              </p>
            )}

            {data?.items.map((item) => (
              <div
                key={item.id}
                className={`grid grid-cols-2 items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 last:border-b-0 hover:bg-white/[0.03] ${grid}`}
              >
                {columns.map((c) => (
                  <div
                    key={c.label}
                    className={`min-w-0 ${c.align === "right" ? "md:text-right" : ""}`}
                  >
                    {/* The header row is desktop-only; on phones each
                        cell names itself. */}
                    <p className="text-xs text-white/40 md:hidden">{c.label}</p>
                    {c.cell(item, filterBy)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {data && pages > 1 && (
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              disabled={page <= 1}
              onClick={() => go({ page: page - 1 })}
            >
              Previous
            </Button>
            <span className="text-sm text-white/60 tabular-nums">
              Page {page} of {pages}
            </span>
            <Button
              variant="ghost"
              disabled={page >= pages}
              onClick={() => go({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Surface>
  );
};

// Cells

const Wallet = ({
  address,
  name,
  filterBy,
}: {
  address: Address;
  name?: string | null;
  filterBy: (address: Address) => void;
}) => (
  <div className="min-w-0">
    <button
      type="button"
      onClick={() => filterBy(address)}
      title={`Show only ${address}`}
      className="max-w-full cursor-pointer truncate font-mono text-sm text-white/70 transition hover:text-white"
    >
      {shortAddress(address)}
    </button>
    {name && <p className="truncate text-xs text-white/40">{name}</p>}
  </div>
);

const Strong = ({ children }: { children: ReactNode }) => (
  <span className="text-sm font-semibold text-white tabular-nums">
    {children}
  </span>
);

const When = ({ at }: { at: string | null }) =>
  at ? (
    <time dateTime={at} className="text-xs text-white/40">
      {formatDateTime(at)}
    </time>
  ) : (
    <span className="text-xs text-white/40">{PLACEHOLDER}</span>
  );

const TxLink = ({ hash }: { hash: string }) => (
  <a
    href={`${EXPLORER_TX_URL}${hash}`}
    target="_blank"
    rel="noreferrer"
    title={hash}
    className="inline-flex items-center gap-1 font-mono text-xs text-ink-light transition hover:text-white"
  >
    {shortAddress(hash)}
    <ExternalLinkIcon className="h-3 w-3" />
  </a>
);

const xp = (points: number) => (points > 0 ? `+${formatNumber(points)}` : "0");

// Check-in days are UTC dates, so they're shown as such, not shifted to the
// viewer's time zone.
const formatUtcDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Columns

// Columns shared by the Users and Users with XP lists, so both read alike.

const XP_COLUMN: Column<{ xp: number; level: number }> = {
  label: "XP",
  cell: (u) => (
    <>
      <Strong>{formatNumber(u.xp)}</Strong>
      <p className="text-xs text-white/40">Level {u.level}</p>
    </>
  ),
};

const REFERRALS_COLUMN: Column<{
  referrals: number;
  rewardedReferrals: number;
}> = {
  label: "Referrals",
  cell: (u) => (
    <>
      <Strong>{formatNumber(u.referrals)}</Strong>
      {u.referrals > 0 && (
        <p className="text-xs text-white/40">
          {formatNumber(u.rewardedReferrals)} rewarded
        </p>
      )}
    </>
  ),
};

const X_COLUMN: Column<{ xUsername: string | null }> = {
  label: "X",
  cell: (u) =>
    u.xUsername ? (
      <a
        href={`https://x.com/${u.xUsername}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-1 text-sm text-ink-light transition hover:text-white"
      >
        <span className="truncate">@{u.xUsername}</span>
        <ExternalLinkIcon className="h-3 w-3 shrink-0" />
      </a>
    ) : (
      <span className="text-xs text-white/40">{PLACEHOLDER}</span>
    ),
};

const USER_COLUMNS: Column<StatsUser>[] = [
  {
    label: "Wallet",
    cell: (u, filterBy) => (
      <Wallet address={u.address} name={u.name} filterBy={filterBy} />
    ),
  },
  XP_COLUMN,
  REFERRALS_COLUMN,
  X_COLUMN,
  { label: "Joined", cell: (u) => <When at={u.createdAt} /> },
  { label: "Last sign-in", cell: (u) => <When at={u.lastLoginAt} /> },
  {
    label: "Invited by",
    cell: (u, filterBy) =>
      u.referrer ? (
        <Wallet
          address={u.referrer}
          name={u.referrerName}
          filterBy={filterBy}
        />
      ) : (
        <span className="text-xs text-white/40">{PLACEHOLDER}</span>
      ),
  },
];

const RANKED_USER_COLUMNS: Column<StatsRankedUser>[] = [
  { label: "#", cell: (u) => <Strong>{u.rank}</Strong> },
  {
    label: "Wallet",
    cell: (u, filterBy) => (
      <Wallet address={u.address} name={u.name} filterBy={filterBy} />
    ),
  },
  XP_COLUMN,
  REFERRALS_COLUMN,
  X_COLUMN,
  { label: "Last XP", align: "right", cell: (u) => <When at={u.lastXpAt} /> },
];

const COMPLETION_GRID = "md:grid-cols-[150px_130px_1fr_80px_170px]";

const completionColumns = (lastLabel: string): Column<StatsCompletion>[] => [
  {
    label: "Wallet",
    cell: (c, filterBy) => (
      <Wallet address={c.address} name={c.name} filterBy={filterBy} />
    ),
  },
  X_COLUMN,
  {
    label: "Quest",
    cell: (c) => (
      <>
        <p className="truncate text-sm font-semibold text-white">{c.quest}</p>
        <p className="mt-0.5 truncate text-xs text-white/40">
          {c.kind === "daily"
            ? "Daily quest"
            : c.kind === "check-in"
              ? "Paid check-in"
              : c.partner
                ? `Partner · ${c.partner}`
                : "Partner quest"}
        </p>
      </>
    ),
  },
  { label: "XP", align: "right", cell: (c) => <Strong>{xp(c.points)}</Strong> },
  {
    label: lastLabel,
    align: "right",
    cell: (c) => (
      <div className="flex flex-col gap-0.5 md:items-end">
        <When at={c.completedAt} />
        {c.txHash && <TxLink hash={c.txHash} />}
      </div>
    ),
  },
];

const COMPLETION_COLUMNS = completionColumns("Completed");
const TRANSACTION_COLUMNS = completionColumns("Transaction");

const CHECK_IN_COLUMNS: Column<StatsCheckIn>[] = [
  {
    label: "Wallet",
    cell: (c, filterBy) => (
      <Wallet address={c.address} name={c.name} filterBy={filterBy} />
    ),
  },
  X_COLUMN,
  {
    label: "Day (UTC)",
    cell: (c) => <Strong>{formatUtcDay(c.day)}</Strong>,
  },
  {
    label: "XP",
    align: "right",
    cell: (c) => (
      <>
        <Strong>{xp(c.points + c.bonusPoints)}</Strong>
        {c.bonusPoints > 0 && (
          <p className="text-xs text-white/40">
            incl. +{formatNumber(c.bonusPoints)} weekly bonus
          </p>
        )}
      </>
    ),
  },
  {
    label: "Checked in",
    align: "right",
    // Paid check-ins link their transaction; free ones have none.
    cell: (c) => (
      <div className="flex flex-col gap-0.5 md:items-end">
        <When at={c.createdAt} />
        {c.txHash && <TxLink hash={c.txHash} />}
      </div>
    ),
  },
];

const TRANSACTION_WALLET_COLUMNS: Column<StatsTransactionWallet>[] = [
  {
    label: "Wallet",
    cell: (w, filterBy) => (
      <Wallet address={w.address} name={w.name} filterBy={filterBy} />
    ),
  },
  X_COLUMN,
  {
    label: "Transactions",
    align: "right",
    cell: (w) => <Strong>{formatNumber(w.transactions)}</Strong>,
  },
  { label: "XP", align: "right", cell: (w) => <Strong>{xp(w.xp)}</Strong> },
  {
    label: "Last transaction",
    align: "right",
    cell: (w) => <When at={w.lastTxAt} />,
  },
];
