import type { ReactNode } from "react";
import { Surface } from "@/shared/ui/surface";

interface PageIntroProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}

// The hero card at the top of every page.
export const PageIntro = ({
  eyebrow,
  title,
  description,
  aside,
}: PageIntroProps) => {
  return (
    <Surface>
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="mb-2 text-sm font-medium text-ink-light">{eyebrow}</p>
          )}

          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {title}
          </h1>

          {description && (
            <p className="mt-3 text-sm leading-6 text-white/65 md:text-base">
              {description}
            </p>
          )}
        </div>

        {aside}
      </div>
    </Surface>
  );
};
