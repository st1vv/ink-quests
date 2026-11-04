import type { BadgeVariant } from "@/shared/ui/badge-colors";

// Partner and daily quest tags (set in the backend's seed.ts) and their
// badge colors; a tag missing here shows in grey.
const TAG_COLORS: Record<string, BadgeVariant> = {
  NFT: "blue",
  Token: "pink",
  GM: "amber",
  DEX: "orange",
  Lending: "sage",
  Bridge: "violet",
  "Perp DEX": "lime",
  Social: "pink",
  xStocks: "turquoise",
};

export const tagVariant = (tag: string): BadgeVariant =>
  TAG_COLORS[tag] ?? "neutral";
