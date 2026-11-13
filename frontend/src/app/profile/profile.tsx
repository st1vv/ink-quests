import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Address } from "viem";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { ValueSkeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { buttonStyles } from "@/shared/ui/button-styles";
import { CopyButton } from "@/shared/ui/copy-button";
import {
  CheckIcon,
  CloseIcon,
  ExternalLinkIcon,
  PencilIcon,
  TelegramIcon,
  WalletIcon,
  XLogoIcon,
} from "@/shared/ui/icons";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  shortAddress,
} from "@/lib/format";
import { EXPLORER_TX_URL } from "@/lib/explorer";
import { toast } from "@/lib/notify";
import { useAuth } from "@/app/auth/use-auth";
import { connectX, useXAccount, useXLinkResult } from "@/app/x/use-x";
import {
  useConnectTelegram,
  useTelegramAccount,
} from "@/app/telegram/use-telegram";
import { useProgress } from "@/app/home/use-progress";
import { useMyRank } from "@/app/leaderboard/use-leaderboard";
import {
  DISPLAY_NAME_PATTERN,
  useActivity,
  useProfileStats,
  useReferrals,
  useSetDisplayName,
  type Activity,
} from "@/app/profile/use-profile";
import { ActivityIcon } from "@/app/profile/activity-icon";

const PLACEHOLDER = "—";

// What a value shows without its data: a skeleton while it loads, a dash
// when loading failed.
const placeholder = (pending: boolean, className?: string) =>
  pending ? <ValueSkeleton className={className} /> : PLACEHOLDER;

export const Profile = () => {
  const { address, status } = useAuth();

  if (!address) return <SignedOutProfile loading={status === "loading"} />;
  return <SignedInProfile address={address} />;
};

const SignedOutProfile = ({ loading }: { loading: boolean }) => {
  const { openConnectModal } = useConnectModal();

  // The wallet may still turn out to be signed in.
  if (loading) {
    return (
      <PageIntro
        eyebrow="Profile"
        title={<ValueSkeleton className="w-40" />}
        description={<ValueSkeleton className="w-64 max-w-full" />}
      />
    );
  }

  return (
    <PageIntro
      eyebrow="Profile"
      title="Your profile"
      description="Connect your wallet to see your XP, level, streaks and activity."
      aside={
        <Button onClick={openConnectModal} className="w-full md:w-auto">
          <WalletIcon className="h-4 w-4" />
          Connect wallet
        </Button>
      }
    />
  );
};

const SignedInProfile = ({ address }: { address: Address }) => {
  // Back from X's consent page: toast the outcome.
  useXLinkResult();
  const { data: progress, isPending: progressPending } = useProgress();
  const { data: rank, isPending: rankPending } = useMyRank();
  const { data: stats, isPending: statsPending } = useProfileStats();
  const { data: x } = useXAccount();
  const { data: telegram } = useTelegramAccount();
  // The name being typed; null when not editing.
  const [draft, setDraft] = useState<string | null>(null);
  const name = stats?.displayName;
  const draftInvalid =
    draft !== null &&
    draft.trim() !== "" &&
    !DISPLAY_NAME_PATTERN.test(draft.trim());

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Profile"
        title={
          draft !== null && stats ? (
            <NameInput
              value={draft}
              current={stats.displayName}
              invalid={draftInvalid}
              onChange={setDraft}
              onClose={() => setDraft(null)}
            />
          ) : (
            <ProfileTitle
              address={address}
              name={name}
              loading={statsPending}
              onEdit={stats ? () => setDraft(name ?? "") : undefined}
            />
          )
        }
        description={
          draft !== null ? (
            <span className={draftInvalid ? "text-red-300" : undefined}>
              Shown instead of your address on the leaderboard. 3-20 letters,
              digits, _ or -. Leave empty to show the address.
            </span>
          ) : stats ? (
            [
              // The name hides the address in the title; keep it in sight.
              name && shortAddress(address),
              `Member since ${formatDate(stats.joinedAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")
          ) : statsPending ? (
            <ValueSkeleton className="w-48" />
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-4">
          <StatCard
            label="Total XP"
            value={
              progress
                ? `${formatNumber(progress.totalXp)} XP`
                : placeholder(progressPending)
            }
          />
          <StatCard
            label="Level"
            value={progress?.level ?? placeholder(progressPending, "w-8")}
          />
          <StatCard
            label="Rank"
            value={
              rank?.rank != null
                ? `#${formatNumber(rank.rank)}`
                : placeholder(rankPending, "w-10")
            }
            hint={rank && rank.rank === null ? "Not ranked yet" : undefined}
          />
          <StatCard
            label="Quests completed"
            value={
              stats
                ? formatNumber(stats.questsCompleted)
                : placeholder(statsPending, "w-10")
            }
          />
        </div>
      </PageIntro>

      {/* Only once X linking is set up on the backend (X_CLIENT_* env). */}
      {x?.available && <XAccountCard />}

      {/* Only once the bot is set up (TELEGRAM_BOT_TOKEN). */}
      {telegram?.available && <TelegramAccountCard />}

      <ReferralCard />

      <ActivityList />
    </div>
  );
};

type ProfileTitleProps = {
  address: Address;
  name: string | null | undefined;
  // The name isn't known yet: a skeleton, not the address it may replace.
  loading: boolean;
  onEdit?: () => void;
};

// The display name when set; the copy button always copies the wallet.
const ProfileTitle = ({
  address,
  name,
  loading,
  onEdit,
}: ProfileTitleProps) => (
  <span className="inline-flex max-w-full min-w-0 items-center gap-3">
    {loading ? (
      <ValueSkeleton className="w-40" />
    ) : (
      <span title={address} className={`truncate ${name ? "" : "font-mono"}`}>
        {name ?? shortAddress(address)}
      </span>
    )}
    <CopyButton text={address} label="address" />
    {onEdit && (
      <IconButton
        onClick={onEdit}
        label={name ? "Change display name" : "Set a display name"}
      >
        <PencilIcon className="h-4 w-4" />
      </IconButton>
    )}
  </span>
);

type NameInputProps = {
  value: string;
  current: string | null;
  invalid: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
};

// Takes the title's place while editing: Enter saves, Escape cancels, and an
// empty name removes it. Failed saves (taken, reserved) toast like every
// other action.
const NameInput = ({
  value,
  current,
  invalid,
  onChange,
  onClose,
}: NameInputProps) => {
  const setName = useSetDisplayName();
  const trimmed = value.trim();

  const save = () => {
    if (trimmed === (current ?? "")) return onClose();
    if (invalid || setName.isPending) return;
    setName.mutate(trimmed, {
      onSuccess: ({ displayName }) => {
        toast.success(displayName ? "Name saved" : "Name removed");
        onClose();
      },
    });
  };

  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onClose();
        }}
        maxLength={20}
        size={20}
        placeholder="Your name"
        aria-label="Display name"
        aria-invalid={invalid}
        disabled={setName.isPending}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        className="w-full min-w-0 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-normal tracking-normal text-white placeholder:text-white/30 focus:border-ink-light focus:outline-none aria-invalid:border-red-400/60 disabled:opacity-60 sm:max-w-xs"
      />
      <IconButton
        onClick={save}
        label="Save name"
        disabled={invalid || setName.isPending}
      >
        <CheckIcon className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={onClose} label="Cancel" disabled={setName.isPending}>
        <CloseIcon className="h-4 w-4" />
      </IconButton>
    </span>
  );
};

type IconButtonProps = {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
};

const IconButton = ({
  onClick,
  label,
  disabled,
  children,
}: IconButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    disabled={disabled}
    className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-ink-light disabled:pointer-events-none disabled:opacity-40"
  >
    {children}
  </button>
);

const XAccountCard = () => {
  const { data: x } = useXAccount();

  return (
    <Surface>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-white">
            <XLogoIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
                {x?.username ? "Verified with X" : "Verify with X"}
              </h2>
              {x?.available && !x.username && (
                <Badge variant="amber" className="px-2 py-0.5 text-xs">
                  Required
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-white/60">
              {x?.username
                ? "Your wallet is verified. Social quests are open to you, and your sign-up counts for the friend who invited you."
                : "Connect your X account to verify your wallet. It's required for social quests and for your sign-up to count for the friend who invited you. One X account per wallet."}
            </p>
          </div>
        </div>

        {x?.username ? (
          <a
            href={`https://x.com/${x.username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 font-mono text-sm text-white transition hover:bg-white/10"
          >
            @{x.username}
            <ExternalLinkIcon className="h-3.5 w-3.5 text-white/50" />
          </a>
        ) : (
          <Button
            onClick={connectX}
            disabled={!x || !x.available}
            className="w-full shrink-0 md:w-auto"
          >
            {x && !x.available ? "Coming soon" : "Connect"}
            <XLogoIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Surface>
  );
};

const TelegramAccountCard = () => {
  const { data: telegram } = useTelegramAccount();
  const { connect, pending } = useConnectTelegram();

  return (
    <Surface>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-white">
            <TelegramIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 max-w-2xl">
            <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
              {telegram?.linked ? "Telegram connected" : "Connect Telegram"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-white/60">
              {telegram?.linked
                ? "Telegram quests are open to you."
                : "Needed for Telegram quests. Our bot opens in Telegram: press Start there and come back. One Telegram account per wallet."}
            </p>
          </div>
        </div>

        {telegram?.linked ? (
          telegram.username ? (
            <a
              href={`https://t.me/${telegram.username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 font-mono text-sm text-white transition hover:bg-white/10"
            >
              @{telegram.username}
              <ExternalLinkIcon className="h-3.5 w-3.5 text-white/50" />
            </a>
          ) : (
            <Badge className="shrink-0 px-3 py-1.5">Connected</Badge>
          )
        ) : (
          <Button
            onClick={() => void connect()}
            disabled={pending}
            className="w-full shrink-0 md:w-auto"
          >
            {pending ? "Opening…" : "Connect"}
            <TelegramIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Surface>
  );
};

const ReferralCard = () => {
  const { data: referrals, isPending } = useReferrals();
  // A linked X account is also required once X linking is set up.
  const { data: x } = useXAccount();
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
            with your link
            {x?.available ? ", connects X" : ""} and completes their first
            onchain quest.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-black/20 py-2 pr-2 pl-4">
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-white/80">
            {link ?? placeholder(isPending, "w-64 max-w-full")}
          </span>
          {link && <CopyButton text={link} label="invite link" />}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Signed up"
            value={
              referrals
                ? formatNumber(referrals.invited)
                : placeholder(isPending, "w-10")
            }
          />
          <StatCard
            label="Rewarded"
            value={
              referrals
                ? formatNumber(referrals.rewarded)
                : placeholder(isPending, "w-10")
            }
          />
          <StatCard
            label="XP earned"
            value={
              referrals
                ? `${formatNumber(referrals.xpEarned)} XP`
                : placeholder(isPending)
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
            Your last 10 check-ins, quests and referrals.
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

// "Oct 22" for a UTC day (YYYY-MM-DD).
const formatUtcDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });

const activityTitle = (item: Activity) => {
  if (item.type === "check-in") {
    // A paid check-in credited after its day (e.g. paid just before
    // midnight) names the day it counts for.
    return item.day && item.day !== item.at.slice(0, 10)
      ? `Daily check-in for ${formatUtcDay(item.day)}`
      : "Daily check-in";
  }
  if (item.type === "campaign") return `Completed the ${item.title} quest`;
  if (item.type === "referral" && item.title) {
    return `Friend ${shortAddress(item.title)} completed a quest`;
  }
  return item.title;
};

const ActivityRow = ({ item }: { item: Activity }) => {
  return (
    <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3.5 last:border-b-0">
      <ActivityIcon type={item.type} />

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
          {/* Only a bonus can take XP away. */}
          {item.points < 0 ? "−" : "+"}
          {formatNumber(Math.abs(item.points + item.bonusPoints))} XP
        </span>
        {item.bonusPoints > 0 && (
          <Badge className="px-2 py-0.5 text-[10px]">
            +{item.bonusPoints} week bonus
          </Badge>
        )}
      </div>
    </div>
  );
};
