import { useState } from "react";

type CampaignCoverProps = {
  src: string;
  title: string;
  className?: string;
};

// A campaign's banner, or a branded gradient with its name when there is
// none or it fails to load.
export const CampaignCover = ({
  src,
  title,
  className = "",
}: CampaignCoverProps) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-linear-to-br from-ink/50 via-ink/15 to-transparent ${className}`}
      >
        <span className="px-4 text-center text-3xl font-bold tracking-tight text-white/90 md:text-4xl">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      loading="lazy"
      onError={() => setHasError(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
};
