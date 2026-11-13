import type { ChatMember } from './telegram.api';

// The bot's commands, for the menu Telegram shows (setMyCommands). Names
// may only use a-z, 0-9 and _.
export const BOT_COMMANDS = [
  { command: 'daily_quests', description: "Today's daily quests" },
  { command: 'leaderboard', description: 'Top 10 players by XP' },
  { command: 'links', description: 'Our website and socials' },
  { command: 'help', description: 'What this bot can do' },
] as const;

// The command in a message and its argument, or null if the message isn't
// a command for this bot. In groups a command may name its bot
// (/links@InkQuestsBot); one naming another bot isn't ours.
export const parseCommand = (text: string, botUsername: string) => {
  const match =
    /^\/([A-Za-z0-9_]{1,32})(?:@([A-Za-z0-9_]{1,32}))?(?:\s+(.*))?$/s.exec(
      text.trim(),
    );
  if (!match) return null;
  const [, command, mention, arg] = match;
  if (mention && mention.toLowerCase() !== botUsername.toLowerCase()) {
    return null;
  }
  return { command: command.toLowerCase(), arg: arg?.trim() ?? '' };
};

// Whether a getChatMember answer means the user is in the chat now.
export const isInChat = (member: ChatMember) =>
  member.status === 'creator' ||
  member.status === 'administrator' ||
  member.status === 'member' ||
  (member.status === 'restricted' && member.is_member === true);

// Text for Telegram's HTML parse mode.
export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const helpMessage = () =>
  [
    '<b>InkQuests bot</b>',
    '',
    "/daily_quests: today's daily quests",
    '/leaderboard: top 10 players by XP',
    '/links: our website and socials',
  ].join('\n');

export const linksMessage = (links: { label: string; url: string }[]) =>
  [
    '<b>InkQuests links</b>',
    '',
    ...links.map((l) => `${escapeHtml(l.label)}: ${escapeHtml(l.url)}`),
  ].join('\n');

// "5h 12m" until the next 00:00 UTC, when daily quests reset.
export const untilReset = (now: Date) => {
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  const minutes = Math.ceil((reset.getTime() - now.getTime()) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export const dailyQuestsMessage = (
  quests: { title: string; points: number }[],
  siteUrl: string,
  now: Date,
) =>
  quests.length
    ? [
        "<b>Today's daily quests</b>",
        '',
        ...quests.map(
          (q, i) => `${i + 1}. ${escapeHtml(q.title)}: <b>+${q.points} XP</b>`,
        ),
        '',
        `Do them on ${escapeHtml(siteUrl)}`,
        `New quests in ${untilReset(now)} (00:00 UTC)`,
      ].join('\n')
    : `No daily quests right now. Check back soon on ${escapeHtml(siteUrl)}`;

// A player as the site shows them: their name, or the short address.
const playerName = (p: { name: string | null; address: string }) =>
  p.name ?? `${p.address.slice(0, 6)}…${p.address.slice(-4)}`;

export const leaderboardMessage = (
  players: { rank: number; name: string | null; address: string; xp: number }[],
  boardUrl: string,
) =>
  players.length
    ? [
        '<b>Top players</b>',
        '',
        ...players.map(
          (p) =>
            `${p.rank}. ${escapeHtml(playerName(p))}: <b>${p.xp.toLocaleString('en-US')} XP</b>`,
        ),
        '',
        `Full leaderboard: ${escapeHtml(boardUrl)}`,
      ].join('\n')
    : `Nobody has XP yet. Be the first: ${escapeHtml(boardUrl)}`;
