// The invite code from a ?ref= link is kept until the visitor signs in, so
// they can look around first and connect a wallet later. The backend only
// uses it when the sign-in creates a new account.
const STORAGE_KEY = "inkquests_ref";
const CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/;

export const captureReferralFromUrl = () => {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("ref");
  if (!code) return;

  if (CODE_PATTERN.test(code)) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Storage blocked (private mode etc.): the referral is just lost.
    }
  }
  // Keep the address bar clean, so the code isn't shared on by accident.
  url.searchParams.delete("ref");
  window.history.replaceState(window.history.state, "", url);
};

export const storedReferral = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

export const clearStoredReferral = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
};
