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

| Variable          | Description                              |
| ----------------- | ---------------------------------------- |
| `PORT`            | HTTP port (default 3000)                 |
| `DATABASE_URL`    | Postgres connection string               |
| `FRONTEND_ORIGIN` | Origin allowed by CORS, with credentials |
