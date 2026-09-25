import { Routes, Route } from "react-router";
import { Layout } from "@/app/layout/layout";
import { Home } from "@/app/home/home";
import { Leaderboard } from "@/app/leaderboard/leaderboard";
import { Quests } from "@/app/quests/quests";
import { Faq } from "@/app/faq/faq";
import { ComingSoon } from "@/app/soon";

export const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/quests/:slug" element={<ComingSoon />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/profile" element={<ComingSoon />} />
      </Routes>
    </Layout>
  );
};
