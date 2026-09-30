# InkQuests backend

NestJS API for InkQuests: users (wallet addresses), quest catalog, quest completions and points.

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
| `RELAY_API_URL`    | Relay API for bridge quests (default: https://api.relay.link)   |

## Auth (Sign-In with Ethereum)

The frontend signs a SIWE message with the connected wallet; the backend checks it and sets
an HttpOnly session cookie (`inkquests_session`, 30 days).

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

### Daily rotation

The daily quests in `seed.ts` are a pool: each UTC day shows **3** of them, picked from 3
different groups and avoiding the previous day's groups when possible (`src/catalog/rotation.ts`).
The pick depends only on the day, and the day's set is stored in `daily_quest_schedule` the first
time the day is requested, so it stays the same for everyone all day. Only quests with a verifier
are picked, and only the day's set can be claimed.

Amount quests (swap, supply, bridge) come in $1 / $5 / $10 variants built by `tiered()` in
`seed.ts`: each step is worth 10 XP more, sets `minUsd` on the quest (which overrides the
verifier's minimum), and shares a `groupKey`, so a day never shows two variants of one quest.

Public routes: `GET /quests/daily` (today's 3), `GET /partners`, `GET /partners/:slug` (with its quests).

## Claiming quests

`POST /quests/:id/claim` (signed in) looks the user's transactions up on the Ink explorer
(Blockscout) and records a completion when one matches the quest's verifier. Daily quests count
transactions since 00:00 UTC and can be claimed once per UTC day; partner quests count
transactions since the quest was added and can be claimed once. `GET /me/completions` returns the
ids completed for the current period.

To make a quest claimable, add an entry to `VERIFIERS` in `src/quests/verifiers.ts` and set the
quest's `verifier` in `seed.ts` to its key (the seed rejects unknown keys). An entry is a list of
accepted calls; the quest is done when any of them matches:

```ts
'tydro-supply-weth': [
  {
    type: 'contract-call',
    contracts: ['0x…'], // from the protocol's docs or onchain wiring
    methods: ['0x617ba037'], // optional: only these function selectors count
    firstArg: '0x4200…0006', // optional: the first argument must be this address
    // optional: the amount (tx value or the second argument) must be worth at least this much;
    // priced by Tydro's AaveOracle, or at $1 for stablecoins with `pegged: true`
    minUsd: { usd: 1, asset: '0x4200…0006', decimals: 18, amountFrom: 'secondArg' },
  },
  // …another way to do the same quest, e.g. through a gateway contract
],
```

The InkySwap swap quest uses `{ type: 'inkyswap-swap', minUsd: 1 }`: a successful swap through
InkySwap's UniversalRouter (what its UI uses) or the V2 router from its docs, both on the same V2
pools. The swap is valued by its ETH/WETH side (ETH sent, WETH in, or the guaranteed WETH out) at
Tydro's oracle price; token-to-token swaps without WETH and V4 swaps paid in tokens can't be valued
and don't count. See `src/quests/swap.ts`.

Holder quests use `{ type: 'nft-holder', contract: '0x…' }` instead: the claim passes when the
wallet holds at least one token of that ERC-721 collection (`balanceOf` over RPC), with no
transaction to find. Only the balance counts, so one NFT moved between wallets can be claimed by
each of them.

Bridge quests use `{ type: 'relay-bridge', fromChains: [1, 8453, …], minUsd: 1 }`: the claim asks
Relay's API (`RELAY_API_URL`) for today's bridges to Ink that involve the wallet and passes on a
successful one received by that wallet, from one of `fromChains`, worth at least `minUsd`. The Ink
transaction Relay names must also be found as successful over RPC, and its hash is stored.

Only transactions the wallet sent itself are found, so smart wallets that go through an ERC-4337
bundler can't claim yet.

## Progress and levels

`GET /me/progress` (signed in) returns `{ totalXp, level, levelXp, nextLevelXp, streak,
checkedInToday, week, checkInXp, fullWeekBonusXp }`; `week` is Monday to Sunday of the current UTC
week, true where the user checked in. `totalXp` sums quest completions, check-ins, referral
rewards and campaign rewards. `levelXp` / `nextLevelXp` are the total XP at which the current and
next level start.

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

## Profile

Signed-in extras for the profile page, next to `/me/progress` and `/me/rank`:

- `GET /me/stats`: `{ joinedAt, questsCompleted }`.
- `GET /me/activity`: the latest 10 XP-earning actions, newest first, as
  `{ type: 'check-in' | 'quest', title, points, bonusPoints, at, txHash }[]`.

## Referrals

- Every user gets an 8-character invite code (no 0/O/1/I), created the first time
  `GET /me/referrals` is called; the invite link is `<frontend>/?ref=<code>`.
- `POST /auth/verify` takes an optional `ref`. It links the new user to the referrer only when
  that sign-in creates the account; existing users are never re-assigned, and a bad code is
  ignored rather than failing the login.
- The referrer gets 50 XP (`REFERRAL_XP` in `src/referrals/referrals.service.ts`) when the invited
  user completes their first onchain quest, paid once per invited user (`referral_rewards`,
  unique `referred_id`). Waiting for an onchain quest keeps free sign-ups from farming it.
- `GET /me/referrals`: `{ code, invited, rewarded, xpEarned, rewardXp }`. Referral XP counts in
  `/me/progress`, the leaderboard and `/me/activity` (type `referral`).

## X accounts and partner quests

Wallets link an X account with OAuth 2.0 + PKCE: `GET /auth/x/start` (signed in, opened as a
full-page navigation) redirects to X, X redirects back to `GET /auth/x/callback`, which stores the
X user id and handle and sends the browser to `<frontend>/profile?x=<result>`. No tokens are kept.
One X account per wallet (unique `x_user_id`), and a wallet can't switch to another X account, so
X tasks can't be farmed across wallets. `GET /me/x` → `{ available, username }`.

### Partner quests (campaigns)

The Quests page lists campaigns: partners (`PARTNERS` in `seed.ts`) with one-time tasks, which are
`kind: 'partner'` quests with `partner: '<slug>'`. `GET /partners` returns only partners with active
tasks, plus `tasks` and `rewardXp`; `GET /partners/:slug` returns the tasks with a `type` for the UI
(`x-follow`, `nft-holder`, `daily-quest`, `onchain`). A task uses any verifier; two are campaign
specific:

- `{ type: 'x-follow', handle }`: follow an X account. Not checked with X (its API charges per read
  and has no cheap "does A follow B" lookup): the follow is taken on trust. Once X linking is set
  up (`X_CLIENT_*`), the claim also needs a linked X account; without it, follows verify with no X
  account and the profile hides the X card.
- `{ type: 'daily-quest-done' }`: the user has completed at least one daily quest.

Neither is an onchain action by the user, so they don't pay referral rewards. A partner with an
empty `imageUrl` gets a gradient banner on the frontend.

**Reward.** Tasks are worth 0 XP and are only verified one by one (the usual
`POST /quests/:id/claim`, recording a 0 XP completion). The campaign pays the partner's
`rewardXp` once, when every active task is verified: `POST /partners/:slug/claim` (422 with how many
tasks are left, 409 if already claimed). Rewards live in `campaign_rewards` and count toward XP, the
leaderboard and activity (type `campaign`); `GET /me/campaigns` → `{ claimed: slug[] }`.

Setup: create a project and app on developer.x.com, turn on **OAuth 2.0** as a **Web App**
(confidential client), set the callback URL to `X_REDIRECT_URI` and the website to the frontend,
then set `X_CLIENT_ID`, `X_CLIENT_SECRET` and `X_REDIRECT_URI`. Linking reads `/2/users/me` once,
which X bills under its pay-per-use pricing.
