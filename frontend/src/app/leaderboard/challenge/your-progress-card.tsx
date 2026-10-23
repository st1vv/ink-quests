import type { ReactNode } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Surface } from "@/shared/ui/surface";
import { Button } from "@/shared/ui/button";
import { CheckIcon, XLogoIcon } from "@/shared/ui/icons";
import { formatNumber } from "@/lib/format";
import { connectX } from "@/app/x/use-x";
import { PLACEHOLDER } from "@/app/leaderboard/podium";
import { CardTitle } from "@/app/leaderboard/challenge/card-title";
import type { Challenge, MyChallenge } from "@/app/leaderboard/use-leaderboard";

type YourProgressCardProps = {
  challenge: Challenge;
  signedIn: boolean;
  me: MyChallenge | null;
};

// The player's place, or what keeps them out (no wallet, no X).
export const YourProgressCard = ({
  challenge,
  signedIn,
  me,
}: YourProgressCardProps) => {
  const { openConnectModal } = useConnectModal();

  let body: ReactNode;
  if (!signedIn) {
    body = (
      <>
        <p className="text-sm leading-6 text-white/60">
          Connect your wallet to see your place in the challenge.
        </p>
        <Button onClick={openConnectModal} className="w-full">
          Connect wallet
        </Button>
      </>
    );
  } else if (me && !me.eligible) {
    body = (
      <>
        <p className="text-sm leading-6 text-white/60">
          Connect your X account to take part. Until then your XP doesn't count
          in the challenge.
        </p>
        <Button onClick={connectX} className="w-full">
          Connect
          <XLogoIcon className="h-4 w-4" />
        </Button>
      </>
    );
  } else {
    const prizePlace = me?.rank != null && me.rank <= challenge.places;
    body = (
      // Rows share the card's height, so it lines up with Prizes.
      <dl className="flex flex-1 flex-col divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <ProgressRow label="Place">
          {me?.rank != null ? `#${me.rank}` : PLACEHOLDER}
          {prizePlace && (
            <span className="ml-2 text-xs font-medium text-amber-300">
              prize place 🎁
            </span>
          )}
        </ProgressRow>
        <ProgressRow label="Challenge XP">
          {me ? `${formatNumber(me.score)} XP` : PLACEHOLDER}
        </ProgressRow>
        <ProgressRow label="Referrals counted">
          {me
            ? `${me.referralsCounted}/${challenge.referralLimit}`
            : PLACEHOLDER}
        </ProgressRow>
        {challenge.xRequired && (
          <ProgressRow label="X account">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <CheckIcon className="h-3.5 w-3.5" />
              Connected
            </span>
          </ProgressRow>
        )}
      </dl>
    );
  }

  return (
    <Surface className="h-full">
      <div className="flex h-full flex-col gap-4">
        <CardTitle>Your progress</CardTitle>
        {body}
      </div>
    </Surface>
  );
};

const ProgressRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-1 items-center justify-between gap-4 px-4 py-3">
    <dt className="text-sm text-white/50">{label}</dt>
    <dd className="text-right text-sm font-semibold text-white tabular-nums">
      {children}
    </dd>
  </div>
);
