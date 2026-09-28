export const formatNumber = (value: number) => value.toLocaleString("en-US");

// 0x1234…abcd
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

// Sep 25, 2026 (in the viewer's time zone)
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Sep 25, 2026, 3:04 PM (in the viewer's time zone)
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
