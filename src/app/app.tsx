import { Routes, Route } from "react-router";
import { Layout } from "./layout/layout";
import { Home } from "./home/home";
import { Profile } from "./profile/profile";
import { CommingSoon } from "./soon";

export const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<CommingSoon />} />
        <Route path="/quests" element={<CommingSoon />} />
        <Route path="/faq" element={<CommingSoon />} />
      </Routes>
    </Layout>
  );
};
