import { useNavigate } from "react-router";
import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";

export const CommingSoon = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100vh-128px)] items-center justify-center">
      <Surface className="md:p-12">
        <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-[#7132f5]/20 blur-3xl" />
        <div className="relative z-10 text-center">
          <Badge className="mb-4 px-4 py-1.5">New feature in progress</Badge>
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
      </Surface>
    </div>
  );
};
