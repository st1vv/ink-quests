import { useState } from "react";
import { Surface } from "@/shared/ui/surface";

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
      "Daily quests refresh every day at 12:00. After the refresh, a new set of quests becomes available for all users.",
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
      <Surface className="w-full max-w-full">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Frequently Asked Questions
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/65 md:text-base">
            Everything you need to know about daily quests, streaks, rewards,
            and how the platform works.
          </p>
        </div>
      </Surface>

      <Surface className="w-full max-w-full">
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
    <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex cursor-pointer w-full items-center justify-between gap-4 text-left"
      >
        <span className="text-base font-semibold text-white md:text-lg">
          {question}
        </span>

        <span
          className={`text-3xl leading-none text-[#7132f5] transition-transform ${
            isOpen ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>

      {isOpen && (
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
          {answer}
        </p>
      )}
    </div>
  );
};
