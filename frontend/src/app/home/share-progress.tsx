import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { buttonStyles } from "@/shared/ui/button-styles";
import { Skeleton } from "@/shared/ui/skeleton";
import { CloseIcon, XLogoIcon } from "@/shared/ui/icons";
import { formatNumber, shortAddress } from "@/lib/format";
import { notifyError, toast } from "@/lib/notify";
import { useAuth } from "@/app/auth/use-auth";
import type { Progress } from "@/app/home/use-progress";
import { renderShareCard } from "@/app/home/share-card";
import { useMyRank } from "@/app/leaderboard/use-leaderboard";
import { useReferrals } from "@/app/profile/use-profile";

const FILE_NAME = "inkquests-progress.png";

// The post that goes with the image; X adds the invite link after it. Tags
// Ink's own account (@inkonchain), so it can reshare. A streak leads once
// there is one worth showing.
const postText = (progress: Progress, rank: number | null) => {
  const stats = [
    `Level ${progress.level}`,
    `${formatNumber(progress.totalXp)} XP`,
    rank !== null && `#${formatNumber(rank)} on the leaderboard`,
  ]
    .filter(Boolean)
    .join(" · ");

  return progress.streak > 1
    ? [
        `🔥 ${progress.streak}-day check-in streak on @inkquests`,
        `${stats}`,
        "",
        "Daily quests on @inkonchain. Join me:",
      ].join("\n")
    : [
        `${stats} on @inkquests`,
        "",
        "Daily quests on @inkonchain. Join me:",
      ].join("\n");
};

// What the browser can do with an image, known before one is rendered so
// the dialog's buttons don't change once it is.
const canShareImage = () => {
  try {
    return Boolean(
      navigator.canShare?.({
        files: [new File([], FILE_NAME, { type: "image/png" })],
      }),
    );
  } catch {
    return false;
  }
};
const canCopyImage = () =>
  typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write);

type Image = { blob: Blob; url: string };

type ShareProgressProps = {
  progress: Progress;
  // The trigger button's text and classes; the defaults are the compact
  // button next to the home page's progress title.
  label?: string;
  className?: string;
};

// A "Share" button that opens a dialog, renders the card and offers the
// ways to post it. X's share link takes only text, so on desktop the image
// is copied or downloaded and attached by hand; phones also get the system
// share sheet with the image itself.
export const ShareProgress = ({
  progress,
  label = "Share",
  className = "ml-auto px-3 py-1.5 text-xs",
}: ShareProgressProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Bumped on every open and close, so a render that finishes after the
  // dialog closed (or reopened) is dropped.
  const renderId = useRef(0);
  const [image, setImage] = useState<Image | null>(null);
  const [native] = useState(canShareImage);
  const [copyable] = useState(canCopyImage);
  const { address } = useAuth();
  const { data: rank } = useMyRank();
  const { data: referrals } = useReferrals();

  const link = referrals
    ? `${window.location.origin}/?ref=${referrals.code}`
    : window.location.origin;
  const text = postText(progress, rank?.rank ?? null);

  // The object URL lives as long as the image shown.
  useEffect(
    () => () => void (image && URL.revokeObjectURL(image.url)),
    [image],
  );

  // The dialog opens at once with a skeleton of the card's size; the card
  // takes its place when rendered.
  const open = async () => {
    const id = ++renderId.current;
    setImage(null);
    dialogRef.current?.showModal();
    try {
      const blob = await renderShareCard({
        name: rank?.name ?? (address ? shortAddress(address) : ""),
        streak: progress.streak,
        level: progress.level,
        totalXp: progress.totalXp,
        levelProgress:
          ((progress.totalXp - progress.levelXp) /
            (progress.nextLevelXp - progress.levelXp)) *
          100,
        week: progress.week,
        rank: rank?.rank ?? null,
        host: window.location.host,
      });
      if (id === renderId.current) {
        setImage({ blob, url: URL.createObjectURL(blob) });
      }
    } catch (err) {
      if (id !== renderId.current) return;
      notifyError(err);
      dialogRef.current?.close();
    }
  };

  const close = () => dialogRef.current?.close();

  const onClose = () => {
    renderId.current++;
    setImage(null);
  };

  const shareNative = async () => {
    if (!image) return;
    const file = new File([image.blob], FILE_NAME, { type: "image/png" });
    try {
      await navigator.share({ files: [file], text: `${text} ${link}` });
    } catch (err) {
      // Closing the share sheet isn't an error.
      if ((err as { name?: string }).name !== "AbortError") notifyError(err);
    }
  };

  const copyImage = async () => {
    if (!image) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": image.blob }),
      ]);
      toast.success("Image copied. Paste it into your post");
    } catch {
      toast.error("Couldn't copy the image. Download it instead");
    }
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = FILE_NAME;
    a.click();
  };

  const xIntent = `https://x.com/intent/post?${new URLSearchParams({
    text,
    url: link,
  })}`;

  // Two per row on phones, all in one row from sm up.
  const action = "min-w-[calc(50%-0.25rem)] flex-1 sm:min-w-0";

  return (
    <>
      <Button variant="ghost" onClick={open} className={className}>
        {label}
      </Button>

      <dialog
        ref={dialogRef}
        onClose={onClose}
        // A click on the backdrop lands on the dialog itself.
        onClick={(e) => e.target === e.currentTarget && close()}
        // open:flex, not flex: a plain display would show it while closed.
        // The dialog itself never scrolls; its middle part does.
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-canvas p-0 text-white shadow-2xl shadow-black/60 backdrop:bg-black/70 open:flex"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-5 pb-4 md:px-6 md:pt-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Share your progress
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="cursor-pointer rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 md:px-6">
          {/* Fixed 16:9 box, the card's own shape, so nothing moves when
              the image replaces the skeleton. */}
          <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10">
            {image ? (
              <img
                src={image.url}
                alt={`InkQuests progress: ${progress.streak} day streak, level ${progress.level}`}
                className="block h-full w-full"
              />
            ) : (
              <Skeleton className="h-full w-full bg-white/10" />
            )}
          </div>

          <p className="mt-4 text-xs leading-5 text-white/50">
            {native
              ? "Share the image anywhere, or post it on X: your invite link is already in the text."
              : "Copy or download the image, then attach it to your post on X. Your invite link is already in the text."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 px-5 pt-4 pb-5 md:px-6 md:pb-6">
          {native && (
            <Button onClick={shareNative} disabled={!image} className={action}>
              Share
            </Button>
          )}
          {copyable && (
            <Button
              variant={native ? "ghost" : "primary"}
              onClick={copyImage}
              disabled={!image}
              className={action}
            >
              Copy image
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={download}
            disabled={!image}
            className={action}
          >
            Download
          </Button>
          <a
            href={xIntent}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Post on X"
            className={buttonStyles({
              variant: "secondary",
              className: action,
            })}
          >
            Post on
            <XLogoIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </dialog>
    </>
  );
};
