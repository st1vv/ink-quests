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
  useReferrals,
  type Activity,
} from "@/app/profile/use-profile";

const EXPLORER_TX_URL = "https://explorer.inkonchain.com/tx/";
const PLACEHOLDER = "—";

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

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Profile"
        title={<AddressTitle address={address} />}
        description={
          stats ? `Member since ${formatDate(stats.joinedAt)}` : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-4">
          <StatCard
            label="Total XP"
            value={
              progress ? `${formatNumber(progress.totalXp)} XP` : PLACEHOLDER
            }
          />
          <StatCard label="Level" value={progress?.level ?? PLACEHOLDER} />
          <StatCard
            label="Rank"
            value={
              rank?.rank != null ? `#${formatNumber(rank.rank)}` : PLACEHOLDER
            }
            hint={rank && rank.rank === null ? "Not ranked yet" : undefined}
          />
          <StatCard
            label="Quests completed"
            value={stats ? formatNumber(stats.questsCompleted) : PLACEHOLDER}
          />
        </div>
      </PageIntro>

      <ReferralCard />

      <ActivityList />
    </div>
  );
};

const AddressTitle = ({ address }: { address: Address }) => (
  <span className="inline-flex items-center gap-3">
    <span title={address} className="font-mono">
      {shortAddress(address)}
    </span>
    <CopyButton text={address} label="address" />
  </span>
);

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context): nothing to do.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-ink-light"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-emerald-300" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </button>
  );
};

const ReferralCard = () => {
  const { data: referrals } = useReferrals();
  const link = referrals
    ? `${window.location.origin}/?ref=${referrals.code}`
    : null;

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Invite friends
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Get +{referrals?.rewardXp ?? 50} XP for every friend who signs up
            with your link and completes their first onchain quest.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-black/20 py-2 pr-2 pl-4">
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-white/80">
            {link ?? PLACEHOLDER}
          </span>
          {link && <CopyButton text={link} label="invite link" />}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Signed up"
            value={referrals ? formatNumber(referrals.invited) : PLACEHOLDER}
          />
          <StatCard
            label="Completed a quest"
            value={referrals ? formatNumber(referrals.rewarded) : PLACEHOLDER}
          />
          <StatCard
            label="XP earned"
            value={
              referrals ? `${formatNumber(referrals.xpEarned)} XP` : PLACEHOLDER
            }
          />
        </div>
      </div>
    </Surface>
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
            Your latest check-ins, quests and referrals.
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

const ACTIVITY_ICONS: Record<
  Activity["type"],
  { icon: string; style: string }
> = {
  "check-in": { icon: "🔥", style: "bg-ink/20" },
  quest: { icon: "✓", style: "bg-emerald-400/15 text-emerald-300" },
  referral: { icon: "🤝", style: "bg-sky-400/15" },
};

const activityTitle = (item: Activity) => {
  if (item.type === "check-in") return "Daily check-in";
  if (item.type === "referral" && item.title) {
    return `Friend ${shortAddress(item.title)} completed a quest`;
  }
  return item.title;
};

const ActivityRow = ({ item }: { item: Activity }) => {
  const { icon, style } = ACTIVITY_ICONS[item.type];

  return (
    <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3.5 last:border-b-0">
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${style}`}
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white md:text-base">
          {activityTitle(item)}
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
