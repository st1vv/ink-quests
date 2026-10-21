import { normalizePostUrl } from './post-url';

describe('normalizePostUrl', () => {
  it('keeps x.com post links, dropping query and extra path', () => {
    expect(
      normalizePostUrl('https://x.com/inkquests/status/123?s=20&t=abc'),
    ).toBe('https://x.com/inkquests/status/123');
    expect(
      normalizePostUrl(' https://x.com/inkquests/status/123/photo/1 '),
    ).toBe('https://x.com/inkquests/status/123');
  });

  it('turns twitter.com and www links into x.com ones', () => {
    expect(normalizePostUrl('https://twitter.com/inkquests/status/9')).toBe(
      'https://x.com/inkquests/status/9',
    );
    expect(normalizePostUrl('https://www.x.com/inkquests/status/9')).toBe(
      'https://x.com/inkquests/status/9',
    );
  });

  it('rejects anything that is not a post', () => {
    expect(normalizePostUrl('https://x.com/inkquests')).toBeNull();
    expect(normalizePostUrl('http://x.com/inkquests/status/9')).toBeNull();
    expect(normalizePostUrl('https://evil.com/x.com/a/status/9')).toBeNull();
    expect(normalizePostUrl('javascript:alert(1)')).toBeNull();
  });
});
