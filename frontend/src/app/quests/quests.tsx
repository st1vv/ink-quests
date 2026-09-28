import { Link } from "react-router";
import { PageIntro } from "@/shared/ui/page-intro";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";
import { buttonStyles } from "@/shared/ui/button-styles";

// Placeholder until partner quests launch. The partner cards are in git
// history; usePartners (catalog.ts) and GET /partners are still in place.
export const Quests = () => {
  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Ecosystem"
        title="Partner quests"
        description="Explore ecosystem apps on Ink, discover new experiences, and complete partner quests for extra rewards."
      />

      <Surface className="md:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-ink/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-xl text-center">
          <Badge className="mb-4 px-4 py-1.5">Coming soon</Badge>
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
            Ecosystem quests are on the way
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/65 md:text-base">
            We're lining up quests with apps across the Ink ecosystem. Until
            they're live, keep your streak going with the daily quests.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/" className={buttonStyles()}>
              Go to daily quests
            </Link>
          </div>
        </div>
      </Surface>
    </div>
  );
};
