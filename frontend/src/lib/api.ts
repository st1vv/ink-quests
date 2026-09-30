export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Sends the session cookie with every request; the backend allows it via CORS.
export const apiFetch = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message: unknown = body?.message;
    throw new ApiError(
      res.status,
      Array.isArray(message)
        ? message.join(". ")
        : typeof message === "string"
          ? message
          : res.statusText,
    );
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
};
