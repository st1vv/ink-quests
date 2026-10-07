import { Link } from "react-router";
import { Surface } from "@/shared/ui/surface";
import { buttonStyles } from "@/shared/ui/button-styles";

type NotFoundLink = { to: string; label: string };

interface NotFoundProps {
  title?: string;
  description?: string;
  primary?: NotFoundLink;
  secondary?: NotFoundLink;
}

// Any path the app doesn't know, pages hidden from the current wallet, and
// missing items (e.g. a campaign slug) with their own wording.
export const NotFound = ({
  title = "Page not found",
  description = "This page doesn't exist or has moved. Your XP is safe, head back and keep questing.",
  primary = { to: "/", label: "Go home" },
  secondary = { to: "/quests", label: "Browse quests" },
}: NotFoundProps) => {
  return (
    <Surface className="isolate flex min-h-[60vh] flex-col items-center justify-center text-center md:p-12">
      {/* Soft brand glow behind the number. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/25 blur-3xl"
      />

      <p
        aria-hidden
        className="bg-gradient-to-b from-white to-ink-light bg-clip-text text-8xl font-bold leading-none tracking-tighter text-transparent tabular-nums md:text-9xl"
      >
        404
      </p>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white md:text-3xl">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-white/60 md:text-base">
        {description}
      </p>

      <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <Link to={primary.to} className={buttonStyles()}>
          {primary.label}
        </Link>
        <Link to={secondary.to} className={buttonStyles({ variant: "ghost" })}>
          {secondary.label}
        </Link>
      </div>
    </Surface>
  );
};
