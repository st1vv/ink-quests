import { parsePostUrl, postedAt, sharePostProblem } from './share-post';

// An id made at `date`, as X would.
const idAt = (date: string) =>
  ((BigInt(Date.parse(date)) - 1288834974657n) << 22n).toString();

const embed = (author: string, text: string) => ({
  authorUrl: `https://x.com/${author}`,
  html: `<blockquote class="twitter-tweet"><p>${text}</p>&mdash; ${author}</blockquote>`,
});

const since = new Date('2026-11-11T00:00:00Z');
const today = idAt('2026-11-11T10:00:00Z');

describe('postedAt', () => {
  it('reads the time from the id', () => {
    expect(postedAt(idAt('2026-11-11T10:00:00Z')).toISOString()).toBe(
      '2026-11-11T10:00:00.000Z',
    );
  });
});

describe('parsePostUrl', () => {
  it('gives the id and canonical link', () => {
    expect(
      parsePostUrl('https://twitter.com/Someone/status/123/photo/1?s=20'),
    ).toEqual({ url: 'https://x.com/i/status/123', id: '123' });
  });

  it('rejects other links', () => {
    expect(parsePostUrl('https://x.com/someone')).toBeNull();
  });
});

describe('sharePostProblem', () => {
  const check = (
    e: ReturnType<typeof embed>,
    id = today,
    username: string | null = 'alice',
  ) => sharePostProblem(id, e, { username, mention: 'inkquests', since });

  it('accepts a post of today by the user that tags us', () => {
    expect(check(embed('Alice', 'Level 3 on <a href="#">@InkQuests</a>'))).toBe(
      null,
    );
  });

  it('wants the linked account as author', () => {
    expect(check(embed('bob', '@inkquests'))).toBe('author');
  });

  it("skips the author check when X linking isn't set up", () => {
    expect(check(embed('bob', '@inkquests'), today, null)).toBe(null);
  });

  it('wants a post from the day', () => {
    expect(
      check(embed('alice', '@inkquests'), idAt('2026-11-10T23:59:00Z')),
    ).toBe('date');
  });

  it('wants the mention, not a longer handle', () => {
    expect(check(embed('alice', 'gm'))).toBe('mention');
    expect(check(embed('alice', '@inkquestsfan'))).toBe('mention');
  });
});
