import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const questKind = pgEnum('quest_kind', ['daily', 'partner']);

export const users = pgTable('users', {
  id: serial().primaryKey(),
  // Always stored lowercased so lookups don't depend on checksum casing.
  address: varchar({ length: 42 }).notNull().unique(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp({ withTimezone: true }),
  // The user's own invite code; created the first time they ask for it.
  referralCode: varchar({ length: 16 }).unique(),
  // Who invited this user. Set only when the account is created.
  referredById: integer().references((): AnyPgColumn => users.id, {
    onDelete: 'set null',
  }),
  // The linked X account. One X account per wallet (unique), so social
  // quests can't be farmed across wallets.
  xUserId: varchar({ length: 32 }).unique(),
  xUsername: varchar({ length: 32 }),
  xLinkedAt: timestamp({ withTimezone: true }),
});

// In-flight X OAuth logins: the PKCE verifier waits here between the
// redirect to X and the callback. Single use, short-lived.
export const xOauthStates = pgTable('x_oauth_states', {
  state: varchar({ length: 64 }).primaryKey(),
  userId: integer()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeVerifier: varchar({ length: 128 }).notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

// XP paid to a referrer, once per invited user, when that user completes
// their first onchain quest.
export const referralRewards = pgTable('referral_rewards', {
  id: serial().primaryKey(),
  referrerId: integer()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  referredId: integer()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Copied at reward time so changing the reward doesn't rewrite history.
  points: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
  // XP for finishing every task of the campaign; the tasks themselves are
  // worth nothing on their own.
  rewardXp: integer().notNull().default(0),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// A user's reward for finishing all of a campaign's tasks, once per campaign.
export const campaignRewards = pgTable(
  'campaign_rewards',
  {
    id: serial().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    partnerId: integer()
      .notNull()
      .references(() => partners.id),
    // Copied at claim time so changing the reward doesn't rewrite history.
    points: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.userId, t.partnerId)],
);

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
    // Minimum USD value for verifiers that check an amount (swap, supply,
    // bridge); null keeps the verifier's own minimum.
    minUsd: integer(),
    // Variants of one quest (e.g. the $1/$5/$10 swap) share a group, so the
    // daily rotation never shows two of them on the same day. Null means
    // the quest is its own group.
    groupKey: varchar({ length: 64 }),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.kind, t.isActive)],
);

// The daily quests shown on each UTC day, picked from the active daily
// catalog when the day is first requested and kept, so the day's set stays
// the same even if the catalog changes.
export const dailyQuestSchedule = pgTable(
  'daily_quest_schedule',
  {
    day: date({ mode: 'string' }).notNull(),
    position: integer().notNull(),
    questId: integer()
      .notNull()
      .references(() => quests.id),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.position] }),
    uniqueIndex().on(t.day, t.questId),
  ],
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
