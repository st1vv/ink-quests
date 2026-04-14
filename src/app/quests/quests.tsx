import { Link } from "react-router";
import { Surface } from "@/shared/ui/surface";
import { Button } from "@/shared/ui/button";

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
      <Surface className="w-full max-w-full">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Partner quests
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/65 md:text-base">
            Explore ecosystem apps on Ink, discover new experiences, and
            complete partner quests for extra rewards.
          </p>
        </div>
      </Surface>

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
    <div
      className="relative w-full max-w-3xl overflow-hidden
        rounded-[32px]
        border border-white/10
        bg-white/5
        shadow-2xl
        backdrop-blur
        flex h-full max-w-full flex-col p-0"
    >
      <div className="h-48 w-full overflow-hidden rounded-t-[32px]">
        <img
          src={quest.image}
          alt={quest.title}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex h-full flex-col p-8">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-white">{quest.title}</h2>

          <p className="mt-3 text-sm leading-6 text-white/60">
            {quest.description}
          </p>
        </div>

        <div className="mt-5">
          <Link to={`/quests/${quest.slug}`}>
            <Button className="w-full">Explore</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
