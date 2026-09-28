# InkQuest backend

NestJS API for InkQuest: users (wallet addresses), quest catalog, quest completions and points.

## Stack

- NestJS 11
- PostgreSQL 17 (Docker for local dev)
- Drizzle ORM + drizzle-kit migrations
- zod for env validation

## Local setup

The usual way is the whole stack in Docker, see the [root README](../README.md).

To run only the backend on the host (Node 22+), with Postgres from the root `docker-compose.yml`:

```bash
npm install
cp .env.example .env   # defaults match the root docker-compose.yml
npm run db:up          # start only the postgres service and wait until healthy
npm run db:migrate     # apply migrations from ./drizzle
npm run db:seed        # upsert starter partners and daily quests
npm run start:dev
```

Check it: `GET http://localhost:3000/health` → `{"status":"ok","db":"up"}`.

## Database scripts

| Script                | What it does                                              |
| --------------------- | --------------------------------------------------------- |
| `npm run db:up`       | Start the Postgres container                              |
| `npm run db:down`     | Stop it (data is kept in the `postgres-data` volume)      |
| `npm run db:generate` | Create a migration after editing `src/database/schema.ts` |
| `npm run db:migrate`  | Apply pending migrations                                  |
| `npm run db:seed`     | Upsert the starter quest catalog (safe to re-run)         |
| `npm run db:studio`   | Open Drizzle Studio to browse data                        |

## Environment

See `.env.example`. The app refuses to start if a variable is missing or invalid.

| Variable           | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `PORT`             | HTTP port (default 3000)                                        |
| `DATABASE_URL`     | Postgres connection string                                      |
| `FRONTEND_ORIGIN`  | Origin allowed by CORS, with credentials; also the SIWE domain  |
| `INK_RPC_URL`      | Optional Ink RPC for smart-wallet signature checks              |
| `EXPLORER_API_KEY` | Blockscout PRO API key for quest checks; required in production |
| `EXPLORER_API_URL` | Optional override of the Blockscout API base URL                |

## Auth (Sign-In with Ethereum)

The frontend signs a SIWE message with the connected wallet; the backend checks it and sets
an HttpOnly session cookie (`inkquest_session`, 30 days).

| Route               | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `GET /auth/nonce`   | Single-use nonce, valid 10 minutes                                  |
| `POST /auth/verify` | `{ message, signature }` → creates the user if new, sets the cookie |
| `GET /auth/session` | `{ address }` of the current session, or `{ address: null }`        |
| `POST /auth/logout` | Deletes the session and clears the cookie                           |

The message must be for the `FRONTEND_ORIGIN` host and Ink's chain id (57073). To require a
signed-in user on a route, import `AuthModule` and add `@UseGuards(AuthGuard)`; read the user
with `@CurrentUser()`.

## Quest catalog

The catalog lives in code: `src/database/seed.ts` is the source of truth.

1. Add a partner to `PARTNERS` and/or a quest to `QUESTS` (`kind: 'daily'`, or
   `kind: 'partner'` with `partner: '<partner slug>'`).
2. Run `npm run db:seed` (from the repo root in Docker, or here on the host).
3. Commit the change.

Rows are matched by `slug`, so never rename one; every other field is overwritten on each run.
A partner or quest removed from the file is deactivated rather than deleted, since completions
reference it. A quest with `verifier: null` is listed but can't be claimed yet.

Public routes: `GET /quests/daily`, `GET /partners`, `GET /partners/:slug` (with its quests).

## Claiming quests

`POST /quests/:id/claim` (signed in) looks the user's transactions up on the Ink explorer
(Blockscout) and records a completion when one matches the quest's verifier. Daily quests count
transactions since 00:00 UTC and can be claimed once per UTC day; partner quests count
transactions since the quest was added and can be claimed once. `GET /me/completions` returns the
ids completed for the current period.

To make a quest claimable, add a spec to `VERIFIERS` in `src/quests/verifiers.ts` and set the
quest's `verifier` in `seed.ts` to its key (the seed rejects unknown keys):

```ts
'inkyswap-swap': {
  type: 'contract-call',
  contracts: ['0x…'], // router address from the protocol's official docs
  methods: ['0x…'], // optional: only these function selectors count
},
```

Only transactions the wallet sent itself are found, so smart wallets that go through an ERC-4337
bundler can't claim yet.

## Progress and levels

`GET /me/progress` (signed in) returns `{ totalXp, level, levelXp, nextLevelXp, streak,
checkedInToday, week, checkInXp, fullWeekBonusXp }`; `week` is Monday to Sunday of the current UTC
week, true where the user checked in. `totalXp` sums quest completions and check-ins.
`levelXp` / `nextLevelXp` are the total XP at which the current and next level start.

- **Level**: reaching level L takes `125 · L · (L − 1)` XP in total (0, 250, 750, 1500, 2500, …),
  so each level needs 250 XP more than the previous one. The curve lives in
  `src/progress/level.ts`.
- **Check-in**: `POST /me/check-in` gives 10 XP, once per UTC day (409 on a repeat). The Sunday
  check-in that completes a Monday-Sunday week also gives a 10 XP bonus (`bonus_points`). Both
  values are constants in `src/progress/progress.service.ts`; past check-ins keep what they paid.
- **Streak**: consecutive UTC days with a check-in; quests don't count toward it. It stays alive
  through today if the last check-in was yesterday.

## Leaderboard

- `GET /leaderboard` (public): top 100 users by total XP (quests + check-ins) as
  `{ rank, address, xp, level }[]`. Every user has their own rank: on equal XP, whoever reached
  it first (earlier last XP-earning action) is ahead, then whoever signed up first. Users without
  XP aren't listed.
- `GET /me/rank` (signed in): `{ rank, xp, xpToNextRank }`, also for users outside the top.
  `rank` is null until the user has XP; `xpToNextRank` is what it takes to pass the user one
  place above (1 XP if they have the same XP), null for first place.

Both aggregate all completions on every request, which is fine for now; cache or precompute the
totals once that gets slow.
