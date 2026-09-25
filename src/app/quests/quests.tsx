import { useState } from "react";
import { Link } from "react-router";
import { PageIntro } from "@/shared/ui/page-intro";
import { buttonStyles } from "@/shared/ui/button-styles";

type PartnerQuest = {
  id: number;
  slug: string;
  title: string;
  description: string;
  image: string;
};

const partnerQuests: PartnerQuest[] = [
  {
    id: 1,
    slug: "nado",
    title: "Nado",
    description:
      "All-in-one CLOB DEX for spot, perps & money markets powered by unified margin. From the team that brought you Kraken.",
    image:
      "https://pbs.twimg.com/profile_banners/1947417601333989377/1763398031/1500x500",
  },
  {
    id: 2,
    slug: "tydro",
    title: "Tydro",
    description:
      "A decentralized, non-custodial liquidity protocol built on Ink and powered by Aave.",
    image:
      "https://pbs.twimg.com/profile_banners/1927683015334928384/1755613697/1500x500",
  },
  {
    id: 3,
    slug: "inkyswap",
    title: "InkySwap",
    description:
      "The decentralized exchange on Ink, where InkyPump's tokens get their liquidity once they reach the threshold. InkySwap handles the token trading and liquidity pools for Ink Network's DeFi ecosystem.",
    image:
      "https://pbs.twimg.com/profile_banners/1869047804196237312/1736419659/1500x500",
  },
];

export const Quests = () => {
  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Ecosystem"
        title="Partner quests"
        description="Explore ecosystem apps on Ink, discover new experiences, and complete partner quests for extra rewards."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {partnerQuests.map((quest) => (
          <PartnerQuestCard key={quest.id} quest={quest} />
        ))}
      </div>
    </div>
  );
};

type PartnerQuestCardProps = {
  quest: PartnerQuest;
};

const PartnerQuestCard = ({ quest }: PartnerQuestCardProps) => {
  return (
    <Link
      to={`/quests/${quest.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl shadow-black/40 transition duration-300 hover:-translate-y-1 hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-light"
    >
      <div className="aspect-[3/1] w-full overflow-hidden border-b border-white/10">
        <QuestCover src={quest.image} title={quest.title} />
      </div>

      <div className="flex flex-1 flex-col p-6 md:p-8">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-white">{quest.title}</h2>

          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/60">
            {quest.description}
          </p>
        </div>

        <span className={buttonStyles({ className: "mt-6 w-full" })}>
          Explore
          <span className="transition group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
};

type QuestCoverProps = {
  src: string;
  title: string;
};

// Falls back to a branded gradient when the remote banner fails to load.
const QuestCover = ({ src, title }: QuestCoverProps) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-ink/50 via-ink/15 to-transparent">
        <span className="text-4xl font-bold tracking-tight text-white/90">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      loading="lazy"
      onError={() => setHasError(true)}
      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
    />
  );
};
