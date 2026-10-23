import { Surface } from "@/shared/ui/surface";
import { GiftIcon } from "@/shared/ui/icons";
import { PODIUM_STYLES } from "@/app/leaderboard/podium";
import { CardTitle } from "@/app/leaderboard/challenge/card-title";
import type {
  Challenge,
  ChallengePrizeItem,
} from "@/app/leaderboard/use-leaderboard";

// The prize for each place: picture cards when the challenge lists its
// prizes, else one row per place.
export const PrizesCard = ({ challenge }: { challenge: Challenge }) => (
  <Surface className="h-full">
    <div className="flex flex-col gap-4">
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
        <PrizeRows challenge={challenge} />
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

// One row per prize place, styled like the table's podium.
const PrizeRows = ({ challenge }: { challenge: Challenge }) => (
  <ol className="flex flex-col gap-2">
    {Array.from({ length: challenge.places }, (_, i) => i + 1).map((place) => (
      <li
        key={place}
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5"
      >
        <span
          className={`inline-flex min-w-11 items-center justify-center rounded-full px-2 py-1 text-sm font-semibold tabular-nums ${PODIUM_STYLES[place] ?? "bg-white/5 text-white/70"}`}
        >
          #{place}
        </span>
        <span className="flex-1 text-sm font-medium text-white">
          {challenge.prize}
        </span>
        <GiftIcon className="h-4 w-4 text-amber-300" />
      </li>
    ))}
  </ol>
);
