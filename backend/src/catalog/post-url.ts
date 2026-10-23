// A post on X or Twitter: https://x.com/<handle>/status/<id>, with an
// optional trailing path or query that's dropped.
const POST_URL =
  /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/(\w{1,15})\/status\/(\d+)/;

// The canonical x.com link of a post, or null if `url` isn't one.
export const normalizePostUrl = (url: string) => {
  const match = POST_URL.exec(url.trim());
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : null;
};
