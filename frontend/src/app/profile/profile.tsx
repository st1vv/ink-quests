import { useState } from "react";
import { Link } from "react-router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Address } from "viem";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { buttonStyles } from "@/shared/ui/button-styles";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "@/shared/ui/icons";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  shortAddress,
} from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import { useProgress } from "@/app/home/use-progress";
import { useMyRank } from "@/app/leaderboard/use-leaderboard";
import {
  useActivity,
  useProfileStats,
  type Activity,
} from "@/app/profile/use-profile";

const EXPLORER_TX_URL = "https://explorer.inkonchain.com/tx/";
const PLACEHOLDER = "—";

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export const Profile = () => {
  const { address, status } = useAuth();

  if (!address) return <SignedOutProfile loading={status === "loading"} />;
  return <SignedInProfile address={address} />;
};

const SignedOutProfile = ({ loading }: { loading: boolean }) => {
  const { openConnectModal } = useConnectModal();

  return (
    <PageIntro
      eyebrow="Profile"
      title="Your profile"
      description="Connect your wallet to see your XP, level, streaks and activity."
      aside={
        <Button
          onClick={openConnectModal}
          disabled={loading}
          className="w-full md:w-auto"
        >
          Connect wallet
        </Button>
      }
    />
  );
};

const SignedInProfile = ({ address }: { address: Address }) => {
  const { data: progress } = useProgress();
  const { data: rank } = useMyRank();
  const { data: stats } = useProfileStats();

  const levelProgress = progress
    ? ((progress.totalXp - progress.levelXp) /
        (progress.nextLevelXp - progress.levelXp)) *
      100
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Profile"
        title={<AddressTitle address={address} />}
        description={
          stats ? `Member since ${formatDate(stats.joinedAt)}` : undefined
        }
        aside={
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 md:min-w-72">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-white/50">Level</p>
              <p className="text-lg font-semibold text-white tabular-nums">
                {progress?.level ?? PLACEHOLDER}
              </p>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-linear-to-r from-ink to-ink-light"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/40">
              {progress
                ? `${formatNumber(progress.nextLevelXp - progress.totalXp)} XP to level ${progress.level + 1}`
                : PLACEHOLDER}
            </p>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          label="Total XP"
          value={
            progress ? `${formatNumber(progress.totalXp)} XP` : PLACEHOLDER
          }
        />
        <StatCard
          label="Rank"
          value={
            rank?.rank != null ? `#${formatNumber(rank.rank)}` : PLACEHOLDER
          }
          hint={rank && rank.rank === null ? "Not ranked yet" : undefined}
        />
        <StatCard
          label="Current streak"
          value={progress ? `🔥 ${days(progress.streak)}` : PLACEHOLDER}
        />
        <StatCard
          label="Best streak"
          value={stats ? days(stats.bestStreak) : PLACEHOLDER}
        />
        <StatCard
          label="Check-ins"
          value={stats ? formatNumber(stats.checkIns) : PLACEHOLDER}
        />
        <StatCard
          label="Quests completed"
          value={stats ? formatNumber(stats.questsCompleted) : PLACEHOLDER}
        />
      </div>

      <ActivityList />
    </div>
  );
};

const AddressTitle = ({ address }: { address: Address }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context): nothing to do.
    }
  };

  return (
    <span className="inline-flex items-center gap-3">
      <span title={address} className="font-mono">
        {shortAddress(address)}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Address copied" : "Copy address"}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-ink-light"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-emerald-300" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
      </button>
    </span>
  );
};

const ActivityList = () => {
  const activity = useActivity();

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Recent activity
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Your latest check-ins and completed quests.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
          {activity.isPending &&
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className="h-[65px] animate-pulse border-b border-white/10 bg-white/[0.02] last:border-b-0"
              />
            ))}

          {activity.isError && (
            <p className="px-4 py-6 text-center text-sm text-white/60">
              Couldn't load your activity.{" "}
              <button
                type="button"
                onClick={() => activity.refetch()}
                className="cursor-pointer font-semibold text-ink-light hover:text-white"
              >
                Try again
              </button>
            </p>
          )}

          {activity.isSuccess && activity.data.length === 0 && (
            <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
              <p className="text-sm text-white/60">
                No activity yet. Check in or complete a daily quest to get
                started.
              </p>
              <Link to="/" className={buttonStyles()}>
                Go to daily quests
              </Link>
            </div>
          )}

          {activity.data?.map((item, i) => (
            <ActivityRow key={`${item.type}-${item.at}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </Surface>
  );
};

const ActivityRow = ({ item }: { item: Activity }) => {
  const isCheckIn = item.type === "check-in";

  return (
    <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3.5 last:border-b-0">
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${
          isCheckIn ? "bg-ink/20" : "bg-emerald-400/15 text-emerald-300"
        }`}
      >
        {isCheckIn ? "🔥" : "✓"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white md:text-base">
          {isCheckIn ? "Daily check-in" : item.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-white/40">
          <time dateTime={item.at}>{formatDateTime(item.at)}</time>
          {item.txHash && (
            <a
              href={`${EXPLORER_TX_URL}${item.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ink-light transition hover:text-white"
            >
              View transaction
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold text-white tabular-nums md:text-base">
          +{formatNumber(item.points + item.bonusPoints)} XP
        </span>
        {item.bonusPoints > 0 && (
          <Badge className="px-2 py-0.5 text-[10px]">
            incl. +{item.bonusPoints} week bonus
          </Badge>
        )}
      </div>
    </div>
  );
};
