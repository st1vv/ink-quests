import { normalizePostUrl } from '../catalog/post-url';

// X post ids are snowflakes: the top bits are milliseconds since X's epoch.
const X_EPOCH_MS = 1288834974657n;

// When the post with this id was made.
export const postedAt = (postId: string) =>
  new Date(Number((BigInt(postId) >> 22n) + X_EPOCH_MS));

// The post's id and a link to it by id alone, or null if `url` isn't an X
// post. X ignores the handle in a post link, so one post has many links;
// this one is the same for all of them.
export const parsePostUrl = (url: string) => {
  const canonical = normalizePostUrl(url);
  if (!canonical) return null;
  const id = canonical.slice(canonical.lastIndexOf('/') + 1);
  return { url: `https://x.com/i/status/${id}`, id };
};

// What X's oEmbed says about a post: who wrote it (their profile link, which
// is the real author whatever handle the pasted link had) and its text as
// HTML.
export type PostEmbed = { authorUrl: string; html: string };

export type SharePostProblem =
  | 'author' // not by the user's linked X account
  | 'date' // posted before the quest's day
  | 'mention'; // doesn't tag the account it must

// Why a progress post doesn't count, or null if it does. `username` is the
// user's linked X handle, null when X linking isn't set up.
export const sharePostProblem = (
  postId: string,
  embed: PostEmbed,
  {
    username,
    mention,
    since,
  }: { username: string | null; mention: string; since: Date },
): SharePostProblem | null => {
  if (username !== null) {
    const author = /\/([A-Za-z0-9_]{1,15})\/?$/.exec(embed.authorUrl)?.[1];
    if (author?.toLowerCase() !== username.toLowerCase()) return 'author';
  }
  if (postedAt(postId) < since) return 'date';
  // A mention is a link to the profile with "@handle" as its text; the
  // lookahead stops @inkquests from matching @inkquestsfan.
  const tagged = new RegExp(`@${mention}(?![A-Za-z0-9_])`, 'i');
  if (!tagged.test(embed.html)) return 'mention';
  return null;
};
