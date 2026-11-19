import { errorText } from './error-text';

describe('errorText', () => {
  it('adds the cause behind a failed fetch', () => {
    const cause = Object.assign(new Error('connect timeout'), {
      code: 'ETIMEDOUT',
    });
    expect(errorText(new TypeError('fetch failed', { cause }))).toBe(
      'fetch failed (ETIMEDOUT connect timeout)',
    );
  });

  it('keeps a plain message as it is', () => {
    expect(errorText(new Error('Telegram 400: Bad Request'))).toBe(
      'Telegram 400: Bad Request',
    );
    expect(errorText('oops')).toBe('oops');
  });
});
