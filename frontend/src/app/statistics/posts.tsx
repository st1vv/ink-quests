import { useState } from "react";
import { Link } from "react-router";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { Button } from "@/shared/ui/button";
import { buttonStyles } from "@/shared/ui/button-styles";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { useAuth } from "@/app/auth/use-auth";
import { NotFound } from "@/app/not-found/not-found";
import {
  isNotFound,
  useSetSocialPost,
  useSocialPosts,
} from "@/app/statistics/use-statistics";

// Admin page for the X post of the day, which the daily "like & repost"
// quest points at. Hidden like the statistics page: until the backend
// confirms an admin wallet it looks like any missing page.
export const SocialPosts = () => {
  const { address, status } = useAuth();
  const posts = useSocialPosts();

  if (status === "loading" || (address && posts.isPending)) return null;
  if (!address || isNotFound(posts.error)) return <NotFound />;

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Admin"
        title="Posts of the day"
        description='The X post for the daily "Like & repost" quest, per UTC day. A day without a post has no such quest.'
        aside={
          <Link
            to="/statistics"
            className={buttonStyles({
              variant: "ghost",
              className: "w-full md:w-auto",
            })}
          >
            ← Statistics
          </Link>
        }
      />
      <SocialPostsPanel />
    </div>
  );
};

// Today and the 13 days after it: as far ahead as the API lists posts.
const POST_DAYS_SHOWN = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const SocialPostsPanel = () => {
  const posts = useSocialPosts();
  const data = posts.data;
  const days = data
    ? Array.from({ length: POST_DAYS_SHOWN }, (_, i) =>
        new Date(Date.parse(data.today) + i * DAY_MS)
          .toISOString()
          .slice(0, 10),
      )
    : [];
  const postFor = (day: string) =>
    data?.posts.find((p) => p.day === day)?.postUrl ?? "";

  return (
    <Surface>
      <div className="flex flex-col gap-4">
        {posts.isPending && (
          <div
            aria-hidden
            className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]"
          />
        )}
        {posts.isError && (
          <p className="text-sm text-white/60">
            Couldn't load the posts.{" "}
            <button
              type="button"
              onClick={() => posts.refetch()}
              className="cursor-pointer font-semibold text-ink-light hover:text-white"
            >
              Try again
            </button>
          </p>
        )}

        {data && (
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
            {days.map((day, i) => (
              // Keyed by the saved link too, so a save resets the field.
              <SocialPostRow
                key={`${day}:${postFor(day)}`}
                day={day}
                label={i === 0 ? "Today" : i === 1 ? "Tomorrow" : null}
                saved={postFor(day)}
              />
            ))}
          </div>
        )}
      </div>
    </Surface>
  );
};

type SocialPostRowProps = {
  day: string;
  label: string | null;
  saved: string;
};

const SocialPostRow = ({ day, label, saved }: SocialPostRowProps) => {
  const [draft, setDraft] = useState(saved);
  const save = useSetSocialPost();
  const changed = draft.trim() !== saved;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ day, postUrl: draft.trim() });
      }}
      className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 last:border-b-0 md:flex-row md:items-center md:gap-4"
    >
      <div className="md:w-40 md:shrink-0">
        <p className="text-sm font-semibold text-white">
          {label ?? formatUtcWeekday(day)}
        </p>
        <p className="text-xs text-white/40">{day}</p>
      </div>
      <input
        type="url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="https://x.com/inkquests/status/…"
        aria-label={`Post for ${day}`}
        className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-ink/60 focus:outline-none"
      />
      <div className="flex shrink-0 gap-2">
        {saved && !changed && (
          <a
            href={saved}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:text-white"
          >
            Open
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        )}
        {saved && (
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => save.mutate({ day, postUrl: "" })}
          >
            Clear
          </Button>
        )}
        <Button type="submit" disabled={!changed || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
};

// "Wed, Oct 22" for a UTC day.
const formatUtcWeekday = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
