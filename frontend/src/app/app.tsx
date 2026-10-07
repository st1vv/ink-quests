import { Routes, Route } from "react-router";
import { Layout } from "@/app/layout/layout";
import { Home } from "@/app/home/home";
import { Leaderboard } from "@/app/leaderboard/leaderboard";
import { Quests } from "@/app/quests/quests";
import { Campaign } from "@/app/quests/campaign";
import { Faq } from "@/app/faq/faq";
import { Profile } from "@/app/profile/profile";
import { Statistics } from "@/app/statistics/statistics";
import { NotFound } from "@/app/not-found/not-found";

export const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/quests/:slug" element={<Campaign />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};
