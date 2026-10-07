import { useSearchParams } from "react-router";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { formatDateTime, formatNumber, shortAddress } from "@/lib/format";
import { EXPLORER_TX_URL } from "@/lib/explorer";
import { useAuth } from "@/app/auth/use-auth";
import { NotFound } from "@/app/not-found/not-found";
import {
  isNotFound,
  useStatsSummary,
  useStatsTransactions,
  type StatsSummary,
  type StatsTransaction,
} from "@/app/statistics/use-statistics";

const PLACEHOLDER = "—";

// Owner-only stats. Not linked anywhere; the backend decides who sees data.
// Until it confirms an admin wallet the page looks like any missing page,
// so visitors can't tell it exists. Admins sign in with the header button.
export const Statistics = () => {
  const { address, status } = useAuth();
  const stats = useStatsSummary();

  if (status === "loading" || (address && stats.isPending)) return null;
  if (!address || isNotFound(stats.error)) return <NotFound />;

  return (
    <div className="flex flex-col gap-4">
      <StatsOverview
        stats={stats.data}
        onRetry={stats.isError ? () => stats.refetch() : undefined}
      />
      <Transactions />
    </div>
  );
};

type StatsOverviewProps = {
  stats: StatsSummary | undefined;
  onRetry?: () => void;
};

const StatsOverview = ({ stats, onRetry }: StatsOverviewProps) => {
  const value = (pick: (s: StatsSummary) => number) =>
    stats ? formatNumber(pick(stats)) : PLACEHOLDER;

  return (
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
          "Users, quests and onchain transactions across the whole app."
        )
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Users" value={value((s) => s.users)} />
        <StatCard
          label="Users with XP"
          value={value((s) => s.usersWithXp)}
          hint={
            stats && stats.users > 0
              ? `${Math.round((stats.usersWithXp / stats.users) * 100)}% of users`
              : undefined
          }
        />
        <StatCard
          label="Quests completed"
          value={value((s) => s.questsCompleted)}
          hint="daily + partner"
        />
        <StatCard
          label="Daily quests"
          value={value((s) => s.dailyQuestsCompleted)}
        />
        <StatCard
          label="Partner quests"
          value={value((s) => s.partnerQuestsCompleted)}
          hint="every task done"
        />
        <StatCard label="Check-ins" value={value((s) => s.checkIns)} />
        <StatCard
          label="Transactions"
          value={value((s) => s.transactions)}
          hint="quests proven onchain"
        />
        <StatCard
          label="Wallets with transactions"
          value={value((s) => s.transactionUsers)}
        />
      </div>
    </PageIntro>
  );
};

const Transactions = () => {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filter = params.get("address");
  const transactions = useStatsTransactions(page, filter);

  const data = transactions.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const go = (next: { page?: number; address?: string | null }) => {
    const search = new URLSearchParams(params);
    const nextPage = next.page ?? 1;
    if (nextPage > 1) search.set("page", String(nextPage));
    else search.delete("page");
    if (next.address !== undefined) {
      if (next.address) search.set("address", next.address);
      else search.delete("address");
    }
    setParams(search);
  };

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
              Transactions
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Quests completed with an onchain transaction, newest first.
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
          <div className="hidden grid-cols-[150px_1fr_80px_170px] gap-4 border-b border-white/10 px-4 py-3 text-xs font-medium uppercase tracking-wide text-white/40 md:grid">
            <span>Wallet</span>
            <span>Quest</span>
            <span className="text-right">XP</span>
            <span className="text-right">Transaction</span>
          </div>

          <div
            className={`flex flex-col transition-opacity ${transactions.isPlaceholderData ? "opacity-50" : ""}`}
          >
            {transactions.isPending &&
              Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-[61px] animate-pulse border-b border-white/10 bg-white/[0.02] last:border-b-0"
                />
              ))}

            {transactions.isError && (
              <p className="px-4 py-6 text-center text-sm text-white/60">
                Couldn't load the transactions.{" "}
                <button
                  type="button"
                  onClick={() => transactions.refetch()}
                  className="cursor-pointer font-semibold text-ink-light hover:text-white"
                >
                  Try again
                </button>
              </p>
            )}

            {data?.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-white/60">
                No transactions yet.
              </p>
            )}

            {data?.items.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                onWalletClick={() => go({ address: tx.address })}
              />
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

type TransactionRowProps = {
  tx: StatsTransaction;
  onWalletClick: () => void;
};

const TransactionRow = ({ tx, onWalletClick }: TransactionRowProps) => (
  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-white/10 px-4 py-3 last:border-b-0 hover:bg-white/[0.03] md:grid-cols-[150px_1fr_80px_170px]">
    <button
      type="button"
      onClick={onWalletClick}
      title={`Show only ${tx.address}`}
      className="cursor-pointer justify-self-start truncate font-mono text-sm text-white/70 transition hover:text-white"
    >
      {shortAddress(tx.address)}
    </button>

    <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
      <p className="truncate text-sm font-semibold text-white">{tx.quest}</p>
      <p className="mt-0.5 truncate text-xs text-white/40">
        {tx.kind === "daily"
          ? "Daily quest"
          : `Partner · ${tx.partner ?? PLACEHOLDER}`}
      </p>
    </div>

    <span className="text-right text-sm font-semibold text-white tabular-nums">
      {tx.points > 0 ? `+${formatNumber(tx.points)}` : "0"}
    </span>

    <div className="col-span-2 row-start-3 flex items-center gap-3 text-xs text-white/40 md:col-span-1 md:row-start-auto md:flex-col md:items-end md:gap-0.5">
      <time dateTime={tx.completedAt}>{formatDateTime(tx.completedAt)}</time>
      <a
        href={`${EXPLORER_TX_URL}${tx.txHash}`}
        target="_blank"
        rel="noreferrer"
        title={tx.txHash}
        className="inline-flex items-center gap-1 font-mono text-ink-light transition hover:text-white"
      >
        {shortAddress(tx.txHash)}
        <ExternalLinkIcon className="h-3 w-3" />
      </a>
    </div>
  </div>
);
