import { useState } from "react";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";

const faqItems = [
  {
    id: 1,
    question: "What is InkQuest?",
    answer:
      "InkQuest is a platform where users complete simple daily onchain actions in the Ink ecosystem, earn XP, and grow their streak.",
  },
  {
    id: 2,
    question: "How do daily quests work?",
    answer:
      "Every day, a new set of quests becomes available. You complete actions like swaps, bridges, or mints, then return to claim completion and rewards.",
  },
  {
    id: 3,
    question: "Do I need to connect my wallet?",
    answer:
      "Yes, you need to connect your wallet to track your progress, streak, XP, and leaderboard position.",
  },
  {
    id: 4,
    question: "When do quests refresh?",
    answer:
      "Daily quests refresh every day at 00:00 UTC. After the refresh, a new set of quests becomes available for all users.",
  },
  {
    id: 5,
    question: "How is the leaderboard calculated?",
    answer:
      "The leaderboard is based on total XP earned by completing quests and maintaining activity over time.",
  },
];

export const Faq = () => {
  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow="Help"
        title="Frequently Asked Questions"
        description="Everything you need to know about daily quests, streaks, rewards, and how the platform works."
      />

      <Surface>
        <div className="flex flex-col gap-3">
          {faqItems.map((item) => (
            <FaqItem
              key={item.id}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </div>
      </Surface>
    </div>
  );
};

type FaqItemProps = {
  question: string;
  answer: string;
};

const FaqItem = ({ question, answer }: FaqItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`rounded-3xl border bg-black/20 px-5 py-4 transition-colors ${
        isOpen ? "border-ink/30" : "border-white/10 hover:border-white/20"
      }`}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink-light"
      >
        <span className="text-base font-semibold text-white md:text-lg">
          {question}
        </span>

        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xl leading-none text-ink-light transition-transform duration-300 ${
            isOpen ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="max-w-3xl pt-3 text-sm leading-7 text-white/65 md:text-base">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
};
