import { useNavigate } from "react-router";
import { Button } from "../shared/ui/button";

export const CommingSoon = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100vh-128px)] items-center justify-center">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur md:p-12">
        <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-[#7132f5]/20 blur-3xl" />
        <div className="relative z-10 text-center">
          <div className="mb-4 inline-flex rounded-full border border-[#7132f5]/30 bg-[#7132f5]/10 px-4 py-1.5 text-sm font-medium text-[#a884ff]">
            New feature in progress
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Coming Soon
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/65 md:text-base">
            We’re working on something new for Ink Daily Quests. This page is
            currently under construction and will be available soon.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={() => navigate("/")}>Back to Home</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
