import { Link, useParams } from "react-router";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { buttonStyles } from "@/shared/ui/button-styles";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { formatNumber } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/app/auth/use-auth";
import { useRequireAuth } from "@/app/auth/use-require-auth";
import {
  useCampaign,
  type Campaign as CampaignData,
  type CampaignTask,
} from "@/app/quests/catalog";
import {
  useClaimCampaign,
  useClaimedCampaigns,
  useCompletions,
} from "@/app/quests/claims";
import { CampaignCover } from "@/app/quests/campaign-cover";
import { QuestRow } from "@/app/quests/quest-row";
import { useQuestStatuses } from "@/app/quests/quest-status";
import { connectX, useXAccount } from "@/app/x/use-x";

const secondaryLink =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 md:w-auto";

// Tasks checked when claimed (holding an NFT, a daily quest done) can be
// claimed right away; the rest go "open, wait, claim".
const checkedOnClaim = (task: CampaignTask) =>
  task.type === "nft-holder" || task.type === "daily-quest";

export const Campaign = () => {
  const { slug } = useParams();
  const campaign = useCampaign(slug);

  if (campaign.isPending) {
    return (
      <div
        aria-hidden
        className="h-96 animate-pulse rounded-[32px] border border-white/10 bg-white/5"
      />
    );
  }

  if (campaign.isError) {
    const notFound =
      campaign.error instanceof ApiError && campaign.error.status === 404;
    return (
      <Surface className="text-center md:p-12">
        <h1 className="text-2xl font-semibold text-white">
          {notFound ? "Quest not found" : "Couldn't load this quest"}
        </h1>
        <div className="mt-6 flex justify-center gap-3">
          {!notFound && (
            <button
              type="button"
              onClick={() => campaign.refetch()}
              className={buttonStyles()}
            >
              Try again
            </button>
          )}
          <Link to="/quests" className={buttonStyles({ variant: "ghost" })}>
            All quests
          </Link>
        </div>
      </Surface>
    );
  }

  return <CampaignView campaign={campaign.data} />;
};

const CampaignView = ({ campaign }: { campaign: CampaignData }) => {
  const completions = useCompletions();
  const { address } = useAuth();
  const { data: x } = useXAccount();
  const requireAuth = useRequireAuth();
  const { items, start } = useQuestStatuses(
    campaign.quests,
    completions.data,
    (quest) => checkedOnClaim(quest as CampaignTask),
  );

  const claimedCampaigns = useClaimedCampaigns();
  const claimReward = useClaimCampaign();

  const done = items.filter((t) => t.status === "completed").length;
  const total = campaign.quests.length;
  const allVerified = total > 0 && done === total;
  const rewardClaimed = claimedCampaigns.data?.has(campaign.slug) ?? false;

  // With X linking set up, X tasks ask a signed-in user to link X first.
  // Without it, follows are verified on trust, no X account needed.
  const xBlocker =
    address && x?.available && !x.username
      ? { label: "Connect X", onClick: connectX }
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/quests"
        className="w-fit text-sm text-white/50 transition hover:text-white"
      >
        ← All quests
      </Link>

      <Surface className="p-0 md:p-0">
        <div className="aspect-[4/1] w-full overflow-hidden border-b border-white/10">
          <CampaignCover src={campaign.imageUrl} title={campaign.title} />
        </div>
        <div className="flex flex-col gap-6 p-5 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {campaign.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65 md:text-base">
              {campaign.description}
            </p>
            {campaign.websiteUrl && (
              <a
                href={campaign.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-ink-light transition hover:text-white"
              >
                {new URL(campaign.websiteUrl).host}
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 md:min-w-56">
            <p className="text-sm text-white/50">Reward</p>
            <p className="mt-1 text-lg font-semibold text-white tabular-nums">
              +{formatNumber(campaign.rewardXp)} XP
            </p>
            <p className="mt-1 text-xs text-white/40 tabular-nums">
              {rewardClaimed ? "Claimed" : `${done}/${total} tasks verified`}
            </p>
          </div>
        </div>
      </Surface>

      <Surface>
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
              Tasks
            </h2>
            <span className="text-sm text-white/40 tabular-nums">
              {done}/{total}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {items.map((task, i) => (
              <CampaignTaskRow
                key={task.id}
                task={task as typeof task & CampaignTask}
                step={i + 1}
                onStart={requireAuth(start)}
                xBlocker={xBlocker}
              />
            ))}
          </div>

          {/* The XP is paid once, for all tasks together. */}
          <div className="flex flex-col gap-3 rounded-3xl border border-ink/30 bg-ink/10 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-white">
                {rewardClaimed
                  ? `You earned ${formatNumber(campaign.rewardXp)} XP 🎉`
                  : `Verify all tasks to earn ${formatNumber(campaign.rewardXp)} XP`}
              </p>
              <p className="mt-1 text-sm text-white/55">
                {rewardClaimed
                  ? "This quest is complete."
                  : allVerified
                    ? "All tasks are verified. Claim your reward."
                    : `${total - done} of ${total} tasks left.`}
              </p>
            </div>
            {rewardClaimed ? (
              <Badge className="px-3 py-1.5">Claimed</Badge>
            ) : (
              <Button
                variant={allVerified ? "secondary" : "primary"}
                disabled={!allVerified || claimReward.isPending}
                onClick={requireAuth(() =>
                  claimReward.mutate({
                    slug: campaign.slug,
                    title: campaign.title,
                  }),
                )}
                className="w-full md:w-auto"
              >
                {claimReward.isPending
                  ? "Claiming…"
                  : `Claim ${formatNumber(campaign.rewardXp)} XP`}
              </Button>
            )}
          </div>
        </div>
      </Surface>
    </div>
  );
};

type CampaignTaskRowProps = {
  task: Parameters<typeof QuestRow>[0]["quest"] & CampaignTask;
  step: number;
  onStart: (questId: number, actionUrl: string) => void;
  xBlocker?: { label: string; onClick: () => void; disabled?: boolean };
};

const CampaignTaskRow = ({
  task,
  step,
  onStart,
  xBlocker,
}: CampaignTaskRowProps) => {
  switch (task.type) {
    case "x-follow":
      return (
        <QuestRow
          quest={task}
          claimLabel="Verify"
          doneLabel="Verified"
          marker={step}
          actionLabel="Follow ↗"
          onStart={onStart}
          blocker={xBlocker}
        />
      );
    case "nft-holder":
      return (
        <QuestRow
          quest={task}
          claimLabel="Verify"
          doneLabel="Verified"
          marker={step}
          onStart={onStart}
          secondary={
            <a
              href={task.actionUrl}
              target="_blank"
              rel="noreferrer"
              className={secondaryLink}
            >
              View collection ↗
            </a>
          }
        />
      );
    case "daily-quest":
      return (
        <QuestRow
          quest={task}
          claimLabel="Verify"
          doneLabel="Verified"
          marker={step}
          onStart={onStart}
          secondary={
            <Link to="/" className={secondaryLink}>
              Daily quests
            </Link>
          }
        />
      );
    default:
      return (
        <QuestRow
          quest={task}
          claimLabel="Verify"
          doneLabel="Verified"
          marker={step}
          onStart={onStart}
        />
      );
  }
};
