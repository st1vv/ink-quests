import { Surface } from "@/shared/ui/surface";

export const HomeIntro = () => {
  return (
    <Surface className="w-full max-w-full">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Complete simple daily quests on Ink
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/65 md:text-base">
          Discover trusted apps, complete guided actions, earn XP, and build
          your onchain streak every day in the Ink ecosystem.
        </p>
      </div>
    </Surface>
  );
};
