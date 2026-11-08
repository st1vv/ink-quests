import { useState } from "react";
import { Surface } from "@/shared/ui/surface";
import { GiftIcon } from "@/shared/ui/icons";
import { PODIUM_STYLES } from "@/app/leaderboard/podium";
import { CardTitle } from "@/app/leaderboard/challenge/card-title";
import type {
  Challenge,
  ChallengePrizeItem,
} from "@/app/leaderboard/use-leaderboard";

// The prize for each place: picture cards when the challenge lists its
// prizes, else one summary of the prize every place gets.
export const PrizesCard = ({ challenge }: { challenge: Challenge }) => (
  <Surface className="h-full">
    <div className="flex h-full flex-col gap-4">
      <CardTitle>Prizes</CardTitle>
      {challenge.prizeItems?.length ? (
        <ol className="grid grid-cols-3 gap-3">
          {[...challenge.prizeItems]
            .sort((a, b) => a.place - b.place)
            .map((item) => (
              <PrizeTile key={item.place} item={item} />
            ))}
        </ol>
      ) : (
        <PrizeSummary challenge={challenge} />
      )}
    </div>
  </Surface>
);

// A picture with its place and name; the whole tile links to the item.
const PrizeTile = ({ item }: { item: ChallengePrizeItem }) => (
  <li>
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:border-white/25"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <span
          className={`absolute left-2 top-2 inline-flex min-w-9 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums backdrop-blur ${PODIUM_STYLES[item.place] ?? "bg-white/10 text-white/80"}`}
        >
          #{item.place}
        </span>
      </div>
      <p className="truncate px-2.5 py-2 text-center text-xs font-medium text-white/80 transition group-hover:text-white">
        {item.name}
      </p>
    </a>
  </li>
);

// The prize's picture: frontend/public/challenges/<challenge slug>.png,
// added by hand for each challenge. A gift icon until it's there. Links to
// the challenge's prizeUrl (e.g. the OpenSea collection) when it has one.
const PrizeImage = ({ challenge }: { challenge: Challenge }) => {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
        <GiftIcon className="h-6 w-6" />
      </span>
    );
  }
  const image = (
    <img
      src={`/challenges/${challenge.slug}.png`}
      alt={challenge.prize}
      onError={() => setMissing(true)}
      className="h-28 w-28 rounded-2xl border border-white/10 object-cover transition group-hover:border-white/25"
    />
  );
  if (!challenge.prizeUrl) return image;
  return (
    <a
      href={challenge.prizeUrl}
      target="_blank"
      rel="noreferrer"
      title={`View ${challenge.prize}`}
      className="group block overflow-hidden rounded-2xl"
    >
      {image}
    </a>
  );
};

// Every place wins the same prize: say it once, with the winning places as
// podium-styled chips. Fills the card's height to line up with Progress.
const PrizeSummary = ({ challenge }: { challenge: Challenge }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-center">
    {/* Keyed by the challenge, so the next one tries its own picture. */}
    <PrizeImage key={challenge.slug} challenge={challenge} />
    <p className="text-sm text-white/50">
      <span className="text-lg font-semibold text-white">
        {challenge.prize}
      </span>{" "}
      {challenge.places === 1
        ? "for the winner"
        : `for each of the top ${challenge.places}`}
    </p>
    <ol className="flex flex-wrap justify-center gap-2">
      {Array.from({ length: challenge.places }, (_, i) => i + 1).map(
        (place) => (
          <li
            key={place}
            className={`inline-flex min-w-11 items-center justify-center rounded-full px-2 py-1 text-sm font-semibold tabular-nums ${PODIUM_STYLES[place] ?? "bg-white/5 text-white/70"}`}
          >
            #{place}
          </li>
        ),
      )}
    </ol>
  </div>
);
