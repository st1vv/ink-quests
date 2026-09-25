import { useState } from "react";
import { Link } from "react-router";
import { PageIntro } from "@/shared/ui/page-intro";
import { buttonStyles } from "@/shared/ui/button-styles";
import { usePartners, type Partner } from "@/app/quests/catalog";

export const Quests = () => {
  const partners = usePartners();

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Ecosystem"
        title="Partner quests"
        description="Explore ecosystem apps on Ink, discover new experiences, and complete partner quests for extra rewards."
      />

      {partners.isError && (
        <p className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
          Couldn't load partners.{" "}
          <button
            type="button"
            onClick={() => partners.refetch()}
            className="cursor-pointer font-semibold text-ink-light hover:text-white"
          >
            Try again
          </button>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {partners.isPending &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-80 animate-pulse rounded-[32px] border border-white/10 bg-white/5"
            />
          ))}
        {partners.data?.map((partner) => (
          <PartnerQuestCard key={partner.slug} quest={partner} />
        ))}
      </div>
    </div>
  );
};

type PartnerQuestCardProps = {
  quest: Partner;
};

const PartnerQuestCard = ({ quest }: PartnerQuestCardProps) => {
  return (
    <Link
      to={`/quests/${quest.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl shadow-black/40 transition duration-300 hover:-translate-y-1 hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-light"
    >
      <div className="aspect-[3/1] w-full overflow-hidden border-b border-white/10">
        <QuestCover src={quest.imageUrl} title={quest.title} />
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
