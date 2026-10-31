import { Surface } from "@/shared/ui/surface";
import { buttonStyles } from "@/shared/ui/button-styles";
import { ExternalLinkIcon, XLogoIcon } from "@/shared/ui/icons";
import {
  countdown,
  formatUtcRange,
  useNow,
} from "@/app/leaderboard/challenge/time";
import type { Challenge } from "@/app/leaderboard/use-leaderboard";

const STATUS_STYLES: Record<Challenge["status"], string> = {
  live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  upcoming: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  ended: "border-white/15 bg-white/5 text-white/60",
};

const STATUS_LABELS: Record<Challenge["status"], string> = {
  live: "Live",
  upcoming: "Starts soon",
  ended: "Ended",
};

// Title, status with a countdown, dates and the announcement.
export const ChallengeHeader = ({ challenge }: { challenge: Challenge }) => {
  const now = useNow();
  const when =
    challenge.status === "live"
      ? `Ends in ${countdown(challenge.endsAt, now)}`
      : challenge.status === "upcoming"
        ? `Starts in ${countdown(challenge.startsAt, now)}`
        : "Final standings below";

  return (
    <Surface>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-ink-light">
            Challenges
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {challenge.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/60">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[challenge.status]}`}
            >
              {challenge.status === "live" && (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300"
                />
              )}
              {STATUS_LABELS[challenge.status]}
            </span>
            <span className="tabular-nums">{when}</span>
            <span aria-hidden className="text-white/20">
              •
            </span>
            <span>{formatUtcRange(challenge.startsAt, challenge.endsAt)}</span>
          </div>
        </div>

        {challenge.postUrl && (
          <a
            href={challenge.postUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles({
              variant: "ghost",
              className: "w-full shrink-0 md:w-auto",
            })}
          >
            Details on
            <XLogoIcon className="h-3.5 w-3.5" />
            <ExternalLinkIcon className="h-3.5 w-3.5 text-white/50" />
          </a>
        )}
      </div>
    </Surface>
  );
};
