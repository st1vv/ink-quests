import type { ReactNode } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Surface } from "@/shared/ui/surface";
import { Button } from "@/shared/ui/button";
import { CheckIcon, GiftIcon, WalletIcon, XLogoIcon } from "@/shared/ui/icons";
import { ValueSkeleton } from "@/shared/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { connectX } from "@/app/x/use-x";
import { PLACEHOLDER } from "@/app/leaderboard/podium";
import { CardTitle } from "@/app/leaderboard/challenge/card-title";
import type { Challenge, MyChallenge } from "@/app/leaderboard/use-leaderboard";

type YourProgressCardProps = {
  challenge: Challenge;
  signedIn: boolean;
  // Signing in or the player's standing still on its way.
  loading: boolean;
  me: MyChallenge | null;
};

// The player's place, or what keeps them out (no wallet, no X).
export const YourProgressCard = ({
  challenge,
  signedIn,
  loading,
  me,
}: YourProgressCardProps) => {
  const { openConnectModal } = useConnectModal();
  const placeholder = loading ? <ValueSkeleton /> : PLACEHOLDER;

  let body: ReactNode;
  if (!signedIn && !loading) {
    body = (
      <JoinPrompt
        title="Connect your wallet"
        text="See your place, XP and referrals in the challenge."
        action={
          <>
            <WalletIcon className="h-4 w-4" />
            Connect wallet
          </>
        }
        onClick={openConnectModal}
      />
    );
  } else if (me && !me.eligible) {
    body = (
      <JoinPrompt
        title="Connect X to join"
        text="Until then your XP doesn't count in the challenge."
        action={
          <>
            Connect
            <XLogoIcon className="h-4 w-4" />
          </>
        }
        onClick={connectX}
      />
    );
  } else {
    const prizePlace = me?.rank != null && me.rank <= challenge.places;
    body = (
      // Rows share the card's height, so it lines up with Prizes.
      <dl className="flex flex-1 flex-col divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <ProgressRow label="Place">
          {me?.rank != null ? `#${me.rank}` : placeholder}
          {prizePlace && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-300">
              prize place
              <GiftIcon className="h-3.5 w-3.5" />
            </span>
          )}
        </ProgressRow>
        <ProgressRow label="Challenge XP">
          {me ? `${formatNumber(me.score)} XP` : placeholder}
        </ProgressRow>
        <ProgressRow label="Referrals counted">
          {me
            ? `${me.referralsCounted}/${challenge.referralLimit}`
            : placeholder}
        </ProgressRow>
        {challenge.xRequired && (
          <ProgressRow label="X account">
            {loading ? (
              placeholder
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <CheckIcon className="h-3.5 w-3.5" />
                Connected
              </span>
            )}
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

type JoinPromptProps = {
  title: string;
  text: string;
  action: ReactNode;
  onClick?: () => void;
};

// What keeps the player out, centered in the card's free space: a line of
// text and a button.
const JoinPrompt = ({ title, text, action, onClick }: JoinPromptProps) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-6 py-6 text-center">
    <div className="flex flex-col gap-1">
      <p className="font-semibold text-white">{title}</p>
      <p className="max-w-xs text-sm leading-6 text-white/60">{text}</p>
    </div>
    <Button onClick={onClick}>{action}</Button>
  </div>
);

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
