import { Link } from "react-router";
import { PageIntro } from "@/shared/ui/page-intro";

export const HomeIntro = () => {
  return (
    <PageIntro
      eyebrow="Daily quests on Ink"
      title="Complete simple daily quests on Ink"
      description={
        <>
          Discover trusted apps, complete guided actions, earn XP, and build
          your onchain streak every day in the Ink ecosystem.{" "}
          <Link
            to="/faq"
            className="font-medium whitespace-nowrap text-ink-light transition hover:text-white"
          >
            How it works?
          </Link>
        </>
      }
    />
  );
};
