import { Badge, type BadgeVariant } from "@/shared/ui/badge";

// Partner and daily quest tags (set in the backend's seed.ts) and their
// badge colors; a tag missing here shows in grey.
const TAG_COLORS: Record<string, BadgeVariant> = {
  NFT: "blue",
  Token: "pink",
  GM: "amber",
  DEX: "orange",
  Lending: "teal",
  Bridge: "cyan",
  "Perp DEX": "lime",
};

// An API deployed before tags existed sends none.
export const TagBadges = ({ tags = [] }: { tags?: string[] }) =>
  tags.map((tag) => (
    <Badge
      key={tag}
      variant={TAG_COLORS[tag] ?? "neutral"}
      className="px-2 py-0.5 text-xs"
    >
      {tag}
    </Badge>
  ));
