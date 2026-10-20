import { Badge } from "@/shared/ui/badge";
import { tagVariant } from "@/app/quests/tag-colors";

// An API deployed before tags existed sends none.
export const TagBadges = ({ tags = [] }: { tags?: string[] }) =>
  tags.map((tag) => (
    <Badge key={tag} variant={tagVariant(tag)} className="px-2 py-0.5 text-xs">
      {tag}
    </Badge>
  ));
