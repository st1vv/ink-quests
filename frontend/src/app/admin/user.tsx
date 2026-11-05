import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { isAddress } from "viem";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  shortAddress,
} from "@/lib/format";
import { EXPLORER_ADDRESS_URL, EXPLORER_TX_URL } from "@/lib/explorer";
import { useAuth } from "@/app/auth/use-auth";
import { NotFound } from "@/app/not-found/not-found";
import { AdminNav } from "@/app/admin/admin-nav";
import { ActivityIcon } from "@/app/profile/activity-icon";
import {
  isNotFound,
  useStatsList,
  useUserActivity,
  type StatsRankedUser,
  type StatsUser,
  type UserActivity,
} from "@/app/admin/use-admin";

const PLACEHOLDER = "—";

// Admin page with everything one wallet did (/admin/users/0x…); without a
// wallet in the URL it's just the search. Hidden like the statistics page:
// until the backend confirms an admin wallet it looks like any missing page.
export const AdminUser = () => {
  const { address, status } = useAuth();
  const params = useParams();
  const wallet =
    params.address && isAddress(params.address, { strict: false })
      ? params.address
      : null;
  // Read through the statistics users list filtered to the wallet. Without
  // a wallet it still answers, so it also tells whether we're an admin.
  const users = useStatsList<StatsUser>("users", 1, wallet);

  if (status === "loading" || (address && users.isPending)) return null;
  if (!address || isNotFound(users.error)) return <NotFound />;

  const user = wallet
    ? users.data?.items.find(
        (u) => u.address.toLowerCase() === wallet.toLowerCase(),
      )
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <AdminNav />
      <PageIntro
        eyebrow="Admin"
        title={
          user ? (user.name ?? shortAddress(user.address)) : "User activity"
        }
        description={
          !params.address
            ? "Paste a wallet to see its XP and everything it did, campaign tasks included. Wallets in the statistics tables link here too."
            : !wallet
              ? "That's not a wallet address."
              : users.isPlaceholderData
                ? "Loading…"
                : !user
                  ? "No user with this wallet: it never signed in."
                  : undefined
        }
        // Keyed by the wallet, so opening another user resets the field.
        aside={<UserSearch key={wallet ?? ""} current={wallet ?? ""} />}
      >
        {user && !users.isPlaceholderData && <UserOverview user={user} />}
      </PageIntro>
      {user && !users.isPlaceholderData && (
        <ActivityTable wallet={user.address} />
      )}
    </div>
  );
};

const UserSearch = ({ current }: { current: string }) => {
  const [draft, setDraft] = useState(current);
  const navigate = useNavigate();
  const wallet = draft.trim();
  const valid = isAddress(wallet, { strict: false });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/admin/users/${wallet}`);
      }}
      className="flex w-full gap-2 md:w-[440px]"
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="0x…"
        spellCheck={false}
        aria-label="Wallet"
        className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-4 py-2 font-mono text-sm text-white placeholder:text-white/30 focus:border-ink/60 focus:outline-none"
      />
      <Button
        type="submit"
        disabled={!valid || wallet.toLowerCase() === current.toLowerCase()}
      >
        Open
      </Button>
    </form>
  );
};

const UserOverview = ({ user }: { user: StatsUser }) => {
  // The overall place, our own wallets included; null without XP.
  const ranked = useStatsList<StatsRankedUser>(
    "users-with-xp",
    1,
    user.address,
  );
  const rank = ranked.data?.items[0]?.rank;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a
          href={`${EXPLORER_ADDRESS_URL}${user.address}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 font-mono text-white/70 transition hover:text-white"
        >
          <span className="truncate">{user.address}</span>
          <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
        </a>
        {user.xUsername && (
          <a
            href={`https://x.com/${user.xUsername}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-ink-light transition hover:text-white"
          >
            @{user.xUsername}
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        )}
        {user.referrer && (
          <span className="text-white/50">
            Invited by{" "}
            <Link
              to={`/admin/users/${user.referrer}`}
              className="font-mono text-white/70 transition hover:text-white"
            >
              {user.referrerName ?? shortAddress(user.referrer)}
            </Link>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="XP"
          value={formatNumber(user.xp)}
          hint={`Level ${user.level}`}
        />
        <StatCard
          label="Rank"
          value={
            ranked.isPending ? PLACEHOLDER : rank ? `#${rank}` : PLACEHOLDER
          }
          hint={!ranked.isPending && !rank ? "no XP yet" : "our wallets too"}
        />
        <StatCard
          label="Referrals"
          value={formatNumber(user.referrals)}
          hint={
            user.referrals > 0
              ? `${formatNumber(user.rewardedReferrals)} rewarded`
              : undefined
          }
        />
        <StatCard label="Joined" value={formatDate(user.createdAt)} />
        <StatCard
          label="Last sign-in"
          value={user.lastLoginAt ? formatDate(user.lastLoginAt) : PLACEHOLDER}
          hint={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : undefined}
        />
      </div>
    </div>
  );
};

const ActivityTable = ({ wallet }: { wallet: string }) => {
  // The page lives in the URL, so a reload shows the same rows.
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const activity = useUserActivity(wallet, page);
  const data = activity.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const go = (next: number) =>
    setParams(next > 1 ? { page: String(next) } : {});

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Activity
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Check-ins, quests (campaign tasks too), referrals, campaign rewards
            and XP given by hand, newest first.
            {data && ` ${formatNumber(data.total)} in total.`}
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
          <div
            className={`flex flex-col transition-opacity ${activity.isPlaceholderData ? "opacity-50" : ""}`}
          >
            {activity.isPending &&
              Array.from({ length: 5 }, (_, i) => (
                <Skeleton
                  key={i}
                  className="h-[61px] border-b border-white/10 bg-white/[0.02] last:border-b-0"
                />
              ))}

            {activity.isError && (
              <p className="px-4 py-6 text-center text-sm text-white/60">
                Couldn't load the activity.{" "}
                <button
                  type="button"
                  onClick={() => activity.refetch()}
                  className="cursor-pointer font-semibold text-ink-light hover:text-white"
                >
                  Try again
                </button>
              </p>
            )}

            {data?.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-white/60">
                Nothing yet.
              </p>
            )}

            {data?.items.map((item, i) => (
              <ActivityRow key={`${item.type}-${item.at}-${i}`} item={item} />
            ))}
          </div>
        </div>

        {data && pages > 1 && (
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-white/60 tabular-nums">
              Page {page} of {pages}
            </span>
            <Button
              variant="ghost"
              disabled={page >= pages}
              onClick={() => go(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Surface>
  );
};

const KIND_LABELS: Record<UserActivity["type"], string> = {
  "check-in": "Check-in",
  quest: "Daily quest",
  referral: "Referral",
  campaign: "Campaign reward",
  bonus: "Given by hand",
};

// Check-in days are UTC dates, so they're shown as such.
const formatUtcDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const activityTitle = (item: UserActivity): ReactNode => {
  switch (item.type) {
    case "check-in":
      return item.day
        ? `Daily check-in for ${formatUtcDay(item.day)}`
        : "Daily check-in";
    case "referral":
      return item.title ? (
        <>
          Invited{" "}
          <Link
            to={`/admin/users/${item.title}`}
            className="font-mono text-ink-light transition hover:text-white"
          >
            {shortAddress(item.title)}
          </Link>
          , who did an onchain quest
        </>
      ) : (
        "Referral"
      );
    default:
      return item.title;
  }
};

const ActivityRow = ({ item }: { item: UserActivity }) => {
  const total = item.points + item.bonusPoints;

  return (
    <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3 last:border-b-0 hover:bg-white/[0.03]">
      <ActivityIcon type={item.type} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {activityTitle(item)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
          <span>
            {item.partner ? `Task · ${item.partner}` : KIND_LABELS[item.type]}
          </span>
          <time dateTime={item.at}>{formatDateTime(item.at)}</time>
          {item.txHash && (
            <a
              href={`${EXPLORER_TX_URL}${item.txHash}`}
              target="_blank"
              rel="noreferrer"
              title={item.txHash}
              className="inline-flex items-center gap-1 font-mono text-ink-light transition hover:text-white"
            >
              {shortAddress(item.txHash)}
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <XpAmount points={total} />
        {item.bonusPoints > 0 && (
          <Badge className="px-2 py-0.5 text-[10px]">
            +{item.bonusPoints} week bonus
          </Badge>
        )}
      </div>
    </div>
  );
};

const XpAmount = ({ points }: { points: number }) => (
  <span
    className={`text-sm font-semibold tabular-nums ${
      points < 0
        ? "text-red-300"
        : points === 0
          ? "text-white/40"
          : "text-white"
    }`}
  >
    {points > 0 ? "+" : points < 0 ? "−" : ""}
    {formatNumber(Math.abs(points))} XP
  </span>
);
