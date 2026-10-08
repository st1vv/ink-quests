import { displayNameBody } from './display-name';

const parse = (name: string) => displayNameBody.safeParse({ name });

describe('displayNameBody', () => {
  it('accepts a valid name and trims it', () => {
    expect(parse('  Bob_42 ').data).toEqual({ name: 'Bob_42' });
  });

  it('clears the name when empty', () => {
    expect(parse('   ').data).toEqual({ name: null });
  });

  it.each(['ab', 'a'.repeat(21), 'has space', 'émile', 'bob!', 'Ьob'])(
    'rejects %p',
    (name) => expect(parse(name).success).toBe(false),
  );

  it.each(['Admin', 'the_admin', 'InkQuests', 'INK', 'KrakenFan'])(
    'rejects the reserved %p',
    (name) => expect(parse(name).success).toBe(false),
  );

  it('allows names that only contain a short reserved word', () => {
    expect(parse('pinky').success).toBe(true);
  });
});
