import { Routes, Route } from "react-router";
import { Layout } from "@/app/layout/layout";
import { Home } from "@/app/home/home";
import { Profile } from "@/app/profile/profile";
import { Leaderboard } from "@/app/leaderboard/leaderboard";
import { Quests } from "@/app/quests/quests";
import { Faq } from "@/app/faq/faq";
import { CommingSoon } from "@/app/soon";

export const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/quests/:slug" element={<CommingSoon />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/profile" element={<CommingSoon />} />
      </Routes>
    </Layout>
  );
};
