import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Address } from "viem";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { buttonStyles } from "@/shared/ui/button-styles";
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ExternalLinkIcon,
  PencilIcon,
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
  // Back from X's consent page: toast the outcome.
  useXLinkResult();
  const { data: progress } = useProgress();
  const { data: rank } = useMyRank();
  const { data: stats } = useProfileStats();
  const { data: x } = useXAccount();
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
          ) : undefined
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

      {/* Only once X linking is set up on the backend (X_CLIENT_* env). */}
      {x?.available && <XAccountCard />}

      <ReferralCard />

      <ActivityList />
    </div>
  );
};

type ProfileTitleProps = {
  address: Address;
  name: string | null | undefined;
  onEdit?: () => void;
};

// The display name when set; the copy button always copies the wallet.
const ProfileTitle = ({ address, name, onEdit }: ProfileTitleProps) => (
  <span className="inline-flex max-w-full min-w-0 items-center gap-3">
    <span title={address} className={`truncate ${name ? "" : "font-mono"}`}>
      {name ?? shortAddress(address)}
    </span>
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

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Copied ${label}`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context or no permission).
      toast.error(`Couldn't copy the ${label}`);
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

const XAccountCard = () => {
  const { data: x } = useXAccount();

  return (
    <Surface>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-white">
            <XLogoIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
              X account
            </h2>
            <p className="mt-1 text-sm leading-6 text-white/60">
              {x?.username
                ? "Linked to this wallet. Social quests on the Quests page are open to you."
                : "Link your X account to take part in social quests. One X account per wallet."}
            </p>
          </div>
        </div>

        {x?.username ? (
          <a
            href={`https://x.com/${x.username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 font-mono text-sm text-white transition hover:bg-white/10"
          >
            @{x.username}
            <ExternalLinkIcon className="h-3.5 w-3.5 text-white/50" />
          </a>
        ) : (
          <Button
            onClick={connectX}
            disabled={!x || !x.available}
            className="w-full md:w-auto"
          >
            <XLogoIcon className="h-4 w-4" />
            {x && !x.available ? "Coming soon" : "Connect X"}
          </Button>
        )}
      </div>
    </Surface>
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

const ACTIVITY_ICONS: Record<
  Activity["type"],
  { icon: string; style: string }
> = {
  "check-in": { icon: "🔥", style: "bg-ink/20" },
  quest: { icon: "✓", style: "bg-emerald-400/15 text-emerald-300" },
  referral: { icon: "🤝", style: "bg-sky-400/15" },
  campaign: { icon: "🏆", style: "bg-amber-400/15" },
};

const activityTitle = (item: Activity) => {
  if (item.type === "check-in") return "Daily check-in";
  if (item.type === "campaign") return `Completed the ${item.title} quest`;
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
