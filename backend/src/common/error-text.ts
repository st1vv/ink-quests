// An error's message for the logs, with its cause when it has one. Node's
// fetch only says "fetch failed"; the cause says why (e.g. ETIMEDOUT,
// ENOTFOUND, ECONNRESET).
export const errorText = (err: unknown): string => {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause as { code?: string; message?: string } | undefined;
  if (!cause) return err.message;
  const reason = [cause.code, cause.message].filter(Boolean).join(' ');
  return reason ? `${err.message} (${reason})` : err.message;
};
