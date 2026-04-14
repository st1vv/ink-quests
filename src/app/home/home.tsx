import { HomeDailyQuests } from "@/app/home/daily-quests";
import { HomeProgress } from "@/app/home/progress";
import { HomeIntro } from "@/app/home/intro";

export const Home = () => {
  return (
    <section className="w-full flex flex-col gap-4">
      <HomeIntro />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:flex-[7]">
          <HomeDailyQuests />
        </div>

        <div className="lg:flex-[3]">
          <HomeProgress />
        </div>
      </div>
    </section>
  );
};
