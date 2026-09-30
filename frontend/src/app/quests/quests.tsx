import { Link } from "react-router";
import { PageIntro } from "@/shared/ui/page-intro";
import { Badge } from "@/shared/ui/badge";
import { buttonStyles } from "@/shared/ui/button-styles";
import { formatNumber } from "@/lib/format";
import { usePartners, type CampaignSummary } from "@/app/quests/catalog";
import { CampaignCover } from "@/app/quests/campaign-cover";

export const Quests = () => {
  const campaigns = usePartners();

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Ecosystem"
        title="Partner quests"
        description="Explore apps on Ink and complete their quests for extra XP. Each quest is a set of one-time tasks."
      />

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.isPending &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-80 animate-pulse rounded-[32px] border border-white/10 bg-white/5"
            />
          ))}

        {campaigns.data?.map((campaign) => (
          <CampaignCard key={campaign.slug} campaign={campaign} />
        ))}

        {campaigns.isSuccess && <MoreComingCard />}
      </div>
    </div>
  );
};

const CampaignCard = ({ campaign }: { campaign: CampaignSummary }) => (
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
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/60">
          {campaign.description}
        </p>
        <p className="mt-3 text-xs text-white/40">
          {campaign.tasks} {campaign.tasks === 1 ? "task" : "tasks"}
        </p>
      </div>

      <span className={buttonStyles({ className: "mt-6 w-full" })}>
        Explore
        <span className="transition group-hover:translate-x-0.5">→</span>
      </span>
    </div>
  </Link>
);

const MoreComingCard = () => (
  <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 rounded-[32px] border border-dashed border-white/15 p-8 text-center">
    <Badge className="px-3 py-1">Coming soon</Badge>
    <p className="text-lg font-semibold text-white">More quests on the way</p>
    <p className="max-w-xs text-sm leading-6 text-white/55">
      We're lining up quests with apps across the Ink ecosystem.
    </p>
  </div>
);
