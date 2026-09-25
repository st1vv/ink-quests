import { Link } from "react-router";
import { Surface } from "@/shared/ui/surface";
import { Badge } from "@/shared/ui/badge";
import { buttonStyles } from "@/shared/ui/button-styles";

export const ComingSoon = () => {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Surface className="max-w-3xl md:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-ink/20 blur-3xl"
        />
        <div className="relative text-center">
          <Badge className="mb-4 px-4 py-1.5">New feature in progress</Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Coming Soon
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/65 md:text-base">
            We’re working on something new for InkQuest. This page is
            currently under construction and will be available soon.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/" className={buttonStyles()}>
              Back to Home
            </Link>
          </div>
        </div>
      </Surface>
    </div>
  );
};
