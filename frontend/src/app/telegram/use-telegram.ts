import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/auth/use-auth";
import { apiFetch } from "@/lib/api";
import { notifyError } from "@/lib/notify";

export type TelegramAccount = {
  // Whether the bot is set up on the backend at all.
  available: boolean;
  linked: boolean;
  // The linked account's @username (without @); null when it has none.
  username: string | null;
};

// How long to keep asking whether the bot has linked the account.
const LINK_WAIT_MS = 10 * 60 * 1000;
const POLL_MS = 3000;
// When "Connect Telegram" was last pressed, shared by every component that
// shows the account, so all of them pick up the link.
let linkStartedAt = 0;

export const useTelegramAccount = () => {
  const { address } = useAuth();
  return useQuery({
    queryKey: ["telegram", address],
    queryFn: () => apiFetch<TelegramAccount>("/me/telegram"),
    enabled: Boolean(address),
    // The bot links the account in Telegram, out of the page's sight: poll
    // for a while after the link was opened. Coming back to the tab also
    // refetches (React Query's default).
    refetchInterval: (query) =>
      !query.state.data?.linked && Date.now() - linkStartedAt < LINK_WAIT_MS
        ? POLL_MS
        : false,
  });
};

// Opens the bot with a one-time /start link; pressing Start there links
// the account. The tab opens before the request so it isn't blocked as a
// popup.
export const useConnectTelegram = () => {
  const [pending, setPending] = useState(false);
  const account = useTelegramAccount();

  const connect = async () => {
    const tab = window.open("", "_blank");
    setPending(true);
    try {
      const { url } = await apiFetch<{ url: string }>("/me/telegram/link", {
        method: "POST",
      });
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
      linkStartedAt = Date.now();
      void account.refetch();
    } catch (err) {
      tab?.close();
      notifyError(err);
    } finally {
      setPending(false);
    }
  };

  return { connect, pending };
};
