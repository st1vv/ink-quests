import { useSearchParams } from "react-router";
import { TabButton } from "@/shared/ui/tab-button";
import { GlobalBoard } from "@/app/leaderboard/global-board";
import { ChallengeBoard } from "@/app/leaderboard/challenge/challenge-board";

type Board = "all" | "challenge";

// The leaderboard page: the all-time board or the weekly challenge, picked
// with tabs.
export const Leaderboard = () => {
  // Kept in the URL (?board=challenge) so it survives a reload and can be
  // shared.
  const [params, setParams] = useSearchParams();
  const board: Board =
    params.get("board") === "challenge" ? "challenge" : "all";
  const setBoard = (next: Board) =>
    setParams(next === "all" ? {} : { board: next }, { replace: true });

  const tabs = (
    <div
      role="tablist"
      aria-label="Leaderboards"
      className="flex w-fit gap-1 rounded-full border border-white/10 bg-black/20 p-1"
    >
      <TabButton
        selected={board === "all"}
        onClick={() => setBoard("all")}
        label="All time"
      />
      <TabButton
        selected={board === "challenge"}
        onClick={() => setBoard("challenge")}
        label="Weekly challenge"
      />
    </div>
  );

  return board === "all" ? (
    <GlobalBoard tabs={tabs} />
  ) : (
    <ChallengeBoard tabs={tabs} />
  );
};
