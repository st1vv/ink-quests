import { z } from 'zod';

// Names that could pass for the team, a partner or a staff role.
const RESERVED_PARTS = [
  'admin',
  'inkquest',
  'moderator',
  'official',
  'support',
  'kraken',
];
const RESERVED_NAMES = new Set(['ink', 'mod', 'team', 'staff', 'system']);

const isReserved = (name: string) => {
  const lower = name.toLowerCase();
  return (
    RESERVED_NAMES.has(lower) ||
    RESERVED_PARTS.some((part) => lower.includes(part))
  );
};

// An empty name clears it, so the address is shown again. Only Latin
// letters, digits, _ and -: no lookalike letters, spaces or invisible
// characters to copy someone else's name with.
export const displayNameBody = z.object({
  name: z
    .string()
    .trim()
    .transform((name) => name || null)
    .pipe(
      z
        .string()
        .regex(/^[A-Za-z0-9_-]{3,20}$/, 'Use 3-20 letters, digits, _ or -')
        .refine((name) => !isReserved(name), 'This name is reserved')
        .nullable(),
    ),
});
