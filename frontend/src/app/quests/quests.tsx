import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { PageIntro } from "@/shared/ui/page-intro";
import { TabButton } from "@/shared/ui/tab-button";
import { Badge } from "@/shared/ui/badge";
import { badgeColors, type BadgeVariant } from "@/shared/ui/badge-colors";
import { buttonStyles } from "@/shared/ui/button-styles";
import { formatNumber } from "@/lib/format";
import { usePartners, type CampaignSummary } from "@/app/quests/catalog";
import { CampaignCover } from "@/app/quests/campaign-cover";
import { TagBadges } from "@/app/quests/tag-badges";
import { tagVariant } from "@/app/quests/tag-colors";
import { useClaimedCampaigns } from "@/app/quests/claims";
import { useAuth } from "@/app/auth/use-auth";

type Tab = "active" | "completed";

export const Quests = () => {
  const campaigns = usePartners();
  const claimed = useClaimedCampaigns();
  const { address, status } = useAuth();
  const { openConnectModal } = useConnectModal();
  // Tab and tag filter are kept in the URL (?tab=completed&tag=NFT) so they
  // survive a reload and can be shared.
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "completed" ? "completed" : "active";
  const setParam = (key: "tab" | "tag", value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const setTab = (next: Tab) =>
    setParam("tab", next === "active" ? null : next);

  const every = campaigns.data ?? [];
  // The filters are the tags partners actually have, in order of first use.
  const tags = [...new Set(every.flatMap((c) => c.tags ?? []))];
  const rawTag = params.get("tag");
  const tag = rawTag && tags.includes(rawTag) ? rawTag : null;
  const all = tag ? every.filter((c) => c.tags?.includes(tag)) : every;

  const isClaimed = (c: CampaignSummary) => claimed.data?.has(c.slug) ?? false;
  const active = all.filter((c) => !isClaimed(c));
  const completed = all.filter(isClaimed);
  const shown = tab === "active" ? active : completed;

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Ecosystem"
        title="Partner quests"
        description={
          <>
            Explore apps on Ink and complete their quests for extra XP. Each
            quest is a set of one-time tasks. Want a quest for your project?
            Message{" "}
            <a
              href={`https://t.me/${TELEGRAM_CONTACT}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ink-light transition hover:text-white"
            >
              @{TELEGRAM_CONTACT}
            </a>{" "}
            on Telegram.
          </>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="tablist"
          aria-label="Quests"
          className="flex w-fit gap-1 rounded-full border border-white/10 bg-black/20 p-1"
        >
          <TabButton
            selected={tab === "active"}
            onClick={() => setTab("active")}
            label="Active"
            count={campaigns.isSuccess ? active.length : undefined}
          />
          <TabButton
            selected={tab === "completed"}
            onClick={() => setTab("completed")}
            label="Completed"
            count={address && claimed.isSuccess ? completed.length : undefined}
          />
        </div>

        {tags.length > 0 && (
          <div
            role="group"
            aria-label="Filter by category"
            className="flex flex-wrap gap-2"
          >
            <FilterChip
              label="All"
              variant="ink"
              selected={!tag}
              onClick={() => setParam("tag", null)}
            />
            {tags.map((t) => (
              <FilterChip
                key={t}
                label={t}
                variant={tagVariant(t)}
                selected={tag === t}
                onClick={() => setParam("tag", t)}
              />
            ))}
          </div>
        )}
      </div>

      {campaigns.isError && (
        <p className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
          Couldn't load quests.{" "}
          <button
            type="button"
            onClick={() => campaigns.refetch()}
            className="cursor-pointer font-semibold text-ink-light hover:text-white"
          >
            Try again
          </button>
        </p>
      )}

      {tab === "completed" && !address ? (
        <EmptyState
          title="Your completed quests show up here"
          text="Connect your wallet to see the quests you've finished."
          action={
            <button
              type="button"
              onClick={openConnectModal}
              disabled={status === "loading"}
              className={buttonStyles()}
            >
              Connect wallet
            </button>
          }
        />
      ) : (
        <div
          role="tabpanel"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {campaigns.isPending &&
            [0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className="h-80 animate-pulse rounded-[32px] border border-white/10 bg-white/5"
              />
            ))}

          {shown.map((campaign) => (
            <CampaignCard
              key={campaign.slug}
              campaign={campaign}
              completed={isClaimed(campaign)}
            />
          ))}

          {campaigns.isSuccess && tab === "active" && (
            <>
              {active.length === 0 &&
                (tag && all.length === 0 ? (
                  <EmptyCard
                    title={`No ${tag} quests right now`}
                    text="Pick another category or show all quests."
                  />
                ) : all.length > 0 ? (
                  <EmptyCard
                    title="All caught up 🎉"
                    text="You've completed every quest. New ones are on the way."
                  />
                ) : (
                  <EmptyCard
                    title="No quests right now"
                    text="New quests with apps across Ink are on the way."
                  />
                ))}
            </>
          )}

          {campaigns.isSuccess &&
            tab === "completed" &&
            completed.length === 0 && (
              <EmptyCard
                title="No completed quests yet"
                text="Verify all tasks of a quest and claim its reward to see it here."
              />
            )}
        </div>
      )}
    </div>
  );
};

const TELEGRAM_CONTACT = "cryptostiv";

type FilterChipProps = {
  label: string;
  // The tag's badge color; ink for "All".
  variant: BadgeVariant;
  selected: boolean;
  onClick: () => void;
};

// Only the picked one takes its tag's badge color; the rest stay grey
// until picked.
const FilterChip = ({ label, variant, selected, onClick }: FilterChipProps) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-ink-light ${
      selected
        ? badgeColors(variant)
        : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
    }`}
  >
    {label}
  </button>
);

const EmptyCard = ({ title, text }: { title: string; text: string }) => (
  <div className="col-span-full flex min-h-48 flex-col items-center justify-center gap-2 rounded-[32px] border border-white/10 bg-white/5 p-8 text-center">
    <p className="text-lg font-semibold text-white">{title}</p>
    <p className="max-w-xs text-sm leading-6 text-white/55">{text}</p>
  </div>
);

const EmptyState = ({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-white/5 p-10 text-center">
    <p className="text-lg font-semibold text-white">{title}</p>
    <p className="max-w-sm text-sm leading-6 text-white/55">{text}</p>
    {action}
  </div>
);

const CampaignCard = ({
  campaign,
  completed,
}: {
  campaign: CampaignSummary;
  completed: boolean;
}) => (
  <Link
    to={`/quests/${campaign.slug}`}
    className="group flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl shadow-black/40 transition duration-300 hover:-translate-y-1 hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-light"
  >
    <div className="aspect-[3/1] w-full overflow-hidden border-b border-white/10">
      <CampaignCover
        src={campaign.imageUrl}
        title={campaign.title}
        className="transition duration-500 group-hover:scale-105"
      />
    </div>

    <div className="flex flex-1 flex-col p-6 md:p-8">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-white">{campaign.title}</h2>
          <Badge className="px-2 py-0.5 text-xs">
            +{formatNumber(campaign.rewardXp)} XP
          </Badge>
          <TagBadges tags={campaign.tags} />
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/60">
          {campaign.description}
        </p>
        <p className="mt-3 text-xs text-white/40">
          {campaign.tasks} {campaign.tasks === 1 ? "task" : "tasks"}
        </p>
      </div>

      {completed ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-emerald-300">
            Completed
          </span>
          <span className={buttonStyles({ variant: "ghost" })}>View</span>
        </div>
      ) : (
        <span className={buttonStyles({ className: "mt-6 w-full" })}>
          Explore
          <span className="transition group-hover:translate-x-0.5">→</span>
        </span>
      )}
    </div>
  </Link>
);
