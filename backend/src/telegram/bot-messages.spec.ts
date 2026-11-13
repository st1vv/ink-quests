import {
  dailyQuestsMessage,
  leaderboardMessage,
  escapeHtml,
  isInChat,
  parseCommand,
  untilReset,
} from './bot-messages';

describe('parseCommand', () => {
  it('reads a command and its argument', () => {
    expect(parseCommand('/start abc_-1', 'InkQuestsBot')).toEqual({
      command: 'start',
      arg: 'abc_-1',
    });
    expect(parseCommand('/links', 'InkQuestsBot')).toEqual({
      command: 'links',
      arg: '',
    });
  });

  it('takes commands naming this bot, ignoring case', () => {
    expect(parseCommand('/daily_quests@inkquestsbot', 'InkQuestsBot')).toEqual({
      command: 'daily_quests',
      arg: '',
    });
  });

  it('ignores commands for other bots and plain text', () => {
    expect(parseCommand('/links@OtherBot', 'InkQuestsBot')).toBeNull();
    expect(parseCommand('gm /links', 'InkQuestsBot')).toBeNull();
  });
});

describe('isInChat', () => {
  it('counts members, admins and restricted members only', () => {
    expect(isInChat({ status: 'member' })).toBe(true);
    expect(isInChat({ status: 'administrator' })).toBe(true);
    expect(isInChat({ status: 'creator' })).toBe(true);
    expect(isInChat({ status: 'restricted', is_member: true })).toBe(true);
    expect(isInChat({ status: 'restricted', is_member: false })).toBe(false);
    expect(isInChat({ status: 'left' })).toBe(false);
    expect(isInChat({ status: 'kicked' })).toBe(false);
  });
});

describe('messages', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('<b>A & B</b>')).toBe('&lt;b&gt;A &amp; B&lt;/b&gt;');
  });

  it('counts down to 00:00 UTC', () => {
    expect(untilReset(new Date('2026-11-13T18:48:00Z'))).toBe('5h 12m');
    expect(untilReset(new Date('2026-11-13T23:59:30Z'))).toBe('1m');
  });

  it('lists the quests with their XP', () => {
    const text = dailyQuestsMessage(
      [
        { title: 'Say GM', points: 20 },
        { title: 'Swap <$5>', points: 40 },
      ],
      'https://inkquests.xyz',
      new Date('2026-11-13T18:48:00Z'),
    );
    expect(text).toContain('1. Say GM: <b>+20 XP</b>');
    expect(text).toContain('2. Swap &lt;$5&gt;: <b>+40 XP</b>');
    expect(text).toContain('New quests in 5h 12m');
  });

  it('says when there are none', () => {
    expect(dailyQuestsMessage([], 'https://inkquests.xyz', new Date())).toMatch(
      /^No daily quests/,
    );
  });
});

describe('leaderboardMessage', () => {
  const url = 'https://inkquests.xyz/leaderboard';
  const player = (rank: number, name: string | null, xp: number) => ({
    rank,
    name,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    xp,
  });

  it('numbers the places, with the name or short address', () => {
    const text = leaderboardMessage(
      [player(1, 'Alice', 12500), player(2, null, 900), player(4, '<b>', 5)],
      url,
    );
    expect(text).toContain('1. Alice: <b>12,500 XP</b>');
    expect(text).toContain('2. 0x1234…5678: <b>900 XP</b>');
    expect(text).toContain('4. &lt;b&gt;: <b>5 XP</b>');
    expect(text).toContain(url);
  });

  it('says when the board is empty', () => {
    expect(leaderboardMessage([], url)).toMatch(/^Nobody has XP yet/);
  });
});
