import { HomeDailyQuests } from "@/app/home/daily-quests";
import { HomeProgress } from "@/app/home/progress";
import { HomeIntro } from "@/app/home/intro";
import { HomeWeeklyMissions } from "@/app/home/weekly-missions";

export const Home = () => {
  return (
    <section className="w-full flex flex-col gap-4">
      <HomeIntro />
      {/* Daily quests and progress share the first row at one height; the
          weekly missions go under the daily quests. On phones it's one
          column in this order, so the check-in stays near the top. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
        <div className="lg:col-span-7">
          <HomeDailyQuests />
        </div>

        <div className="lg:col-span-3">
          <HomeProgress />
        </div>

        <div className="lg:col-span-7">
          <HomeWeeklyMissions />
        </div>
      </div>
    </section>
  );
};
