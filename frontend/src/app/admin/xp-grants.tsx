import { useState } from "react";
import { isAddress } from "viem";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatDateTime, formatNumber, shortAddress } from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import { NotFound } from "@/app/not-found/not-found";
import { AdminNav } from "@/app/admin/admin-nav";
import {
  isNotFound,
  useGrantXp,
  useStatsList,
  useXpGrants,
  type StatsUser,
} from "@/app/admin/use-admin";

// Admin page for giving XP by hand. Hidden like the statistics page: until
// the backend confirms an admin wallet it looks like any missing page.
export const XpGrants = () => {
  const { address, status } = useAuth();
  const grants = useXpGrants();

  if (status === "loading" || (address && grants.isPending)) return null;
  if (!address || isNotFound(grants.error)) return <NotFound />;

  return (
    <div className="flex flex-col gap-4">
      <AdminNav />
      <PageIntro
        eyebrow="Admin"
        title="Give XP"
        description="Add XP to a wallet, e.g. for a contest win. It counts on the leaderboard (not on challenge boards) and shows in the user's activity with your reason. A negative amount takes XP away."
      />
      <GrantForm />
      <GrantList />
    </div>
  );
};

const inputStyle =
  "min-w-0 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-ink/60 focus:outline-none";

const GrantForm = () => {
  const [address, setAddress] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const grant = useGrantXp();

  const wallet = address.trim();
  const amount = Number(points);
  const valid =
    isAddress(wallet, { strict: false }) &&
    Number.isInteger(amount) &&
    amount !== 0 &&
    reason.trim().length > 0;

  return (
    <Surface>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          grant.mutate(
            { address: wallet, points: amount, reason: reason.trim() },
            // The wallet stays, so a follow-up fix is one field away.
            {
              onSuccess: () => {
                setPoints("");
                setReason("");
              },
            },
          );
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/40">Wallet</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x…"
              spellCheck={false}
              className={`${inputStyle} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/40">XP</span>
            <input
              type="number"
              step={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="100"
              className={`${inputStyle} tabular-nums`}
            />
          </label>
        </div>

        <WalletPreview address={wallet} />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-white/40">
            Reason, shown to the user
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={100}
            placeholder="Winner of the meme contest"
            className={inputStyle}
          />
        </label>

        <div className="flex justify-end">
          <Button type="submit" disabled={!valid || grant.isPending}>
            {grant.isPending
              ? "Saving…"
              : amount < 0
                ? `Take ${formatNumber(-amount)} XP`
                : `Give ${amount > 0 ? formatNumber(amount) : ""} XP`}
          </Button>
        </div>
      </form>
    </Surface>
  );
};

// Who the typed wallet is, so XP doesn't go to the wrong one. Read from
// the statistics users list filtered to that wallet.
const WalletPreview = ({ address }: { address: string }) => {
  const valid = isAddress(address, { strict: false });
  const users = useStatsList<StatsUser>("users", 1, valid ? address : null);

  if (!valid) return null;
  if (users.isPending || users.isPlaceholderData) {
    return <Skeleton className="h-5 w-64 rounded-full bg-white/[0.04]" />;
  }
  const user = users.data?.items.find(
    (u) => u.address.toLowerCase() === address.toLowerCase(),
  );
  if (!user) {
    return (
      <p className="text-sm text-amber-300/80">
        No user with this wallet: they need to sign in once first.
      </p>
    );
  }
  return (
    <p className="text-sm text-white/60">
      {user.name ? (
        <span className="font-semibold text-white">{user.name}</span>
      ) : (
        <span className="font-mono text-white">
          {shortAddress(user.address)}
        </span>
      )}{" "}
      has {formatNumber(user.xp)} XP · Level {user.level}
    </p>
  );
};

const GrantList = () => {
  const grants = useXpGrants();

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Given so far
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            The latest 50 grants, newest first.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
          {grants.isError && (
            <p className="px-4 py-6 text-center text-sm text-white/60">
              Couldn't load the grants.{" "}
              <button
                type="button"
                onClick={() => grants.refetch()}
                className="cursor-pointer font-semibold text-ink-light hover:text-white"
              >
                Try again
              </button>
            </p>
          )}
          {grants.data?.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-white/60">
              No XP given yet.
            </p>
          )}
          {grants.data?.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-4 border-b border-white/10 px-4 py-3 last:border-b-0 hover:bg-white/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {g.reason}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-white/40">
                  <span className="font-mono" title={g.address}>
                    {g.name ?? shortAddress(g.address)}
                  </span>
                  <time dateTime={g.createdAt}>
                    {formatDateTime(g.createdAt)}
                  </time>
                  {g.grantedBy && <span>by {shortAddress(g.grantedBy)}</span>}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  g.points < 0 ? "text-red-300" : "text-white"
                }`}
              >
                {g.points > 0 ? "+" : "−"}
                {formatNumber(Math.abs(g.points))} XP
              </span>
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
};
