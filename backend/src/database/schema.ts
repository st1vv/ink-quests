import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const questKind = pgEnum('quest_kind', ['daily', 'partner']);

export const users = pgTable('users', {
  id: serial().primaryKey(),
  // Always stored lowercased so lookups don't depend on checksum casing.
  address: varchar({ length: 42 }).notNull().unique(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp({ withTimezone: true }),
});

// Single-use SIWE nonces; a row is deleted when a signed message consumes it.
export const authNonces = pgTable('auth_nonces', {
  // viem's generateSiweNonce() returns 96 chars.
  nonce: varchar({ length: 96 }).primaryKey(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

export const sessions = pgTable(
  'sessions',
  {
    // sha256 of the token in the session cookie, so a DB leak can't be
    // replayed as a login.
    id: varchar({ length: 64 }).primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index().on(t.userId)],
);

// One per user per UTC day. Worth XP on its own and the only thing that
// keeps the daily streak going.
export const checkIns = pgTable(
  'check_ins',
  {
    id: serial().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date({ mode: 'string' }).notNull(),
    // Copied at check-in time so changing the reward doesn't rewrite history.
    points: integer().notNull(),
    // Extra XP for the Sunday check-in that completes a Monday-Sunday week.
    bonusPoints: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.userId, t.day)],
);

export const partners = pgTable('partners', {
  id: serial().primaryKey(),
  slug: varchar({ length: 64 }).notNull().unique(),
  title: text().notNull(),
  description: text().notNull(),
  imageUrl: text().notNull(),
  websiteUrl: text(),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const quests = pgTable(
  'quests',
  {
    id: serial().primaryKey(),
    slug: varchar({ length: 64 }).notNull().unique(),
    kind: questKind().notNull(),
    // Only partner quests belong to a partner.
    partnerId: integer().references(() => partners.id),
    title: text().notNull(),
    description: text().notNull(),
    actionUrl: text().notNull(),
    points: integer().notNull(),
    // Key of the server-side verifier that checks the quest onchain;
    // null means the quest can't be claimed yet.
    verifier: varchar({ length: 64 }),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.kind, t.isActive)],
);

export const questCompletions = pgTable(
  'quest_completions',
  {
    id: serial().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id),
    questId: integer()
      .notNull()
      .references(() => quests.id),
    // UTC day for daily quests; a fixed date for one-time quests so the
    // unique index below also blocks repeat claims of those.
    period: date({ mode: 'string' }).notNull(),
    // Points are copied at claim time so later quest edits don't rewrite history.
    points: integer().notNull(),
    txHash: varchar({ length: 66 }),
    completedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.userId, t.questId, t.period)],
);
