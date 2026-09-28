# InkQuests

Quests on [Ink](https://inkonchain.com): complete daily and partner quests onchain, earn points, climb the leaderboard.

| Folder                   | What                                           |
| ------------------------ | ---------------------------------------------- |
| [`frontend/`](frontend/) | React 19 + Vite + Tailwind, wagmi / RainbowKit |
| [`backend/`](backend/)   | NestJS API, PostgreSQL via Drizzle ORM         |

## Run everything with Docker

Requires Docker Desktop.

```bash
npm run dev       # build and start postgres, backend and frontend
npm run db:seed   # first run only: fill the quest catalog
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000 (`/health` checks the DB connection)
- Postgres: `localhost:5432`, user / password / db `inkquests`

Migrations run automatically when the backend container starts. Source folders are mounted
into the containers, so code changes hot-reload.

Optional: put `VITE_WALLETCONNECT_PROJECT_ID` into `frontend/.env.local` to enable
WalletConnect (QR / mobile wallets).

## Root scripts

| Script                | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `npm run dev`         | Build images and start the whole stack (logs in the foreground)     |
| `npm run down`        | Stop and remove the containers (DB data is kept)                    |
| `npm run logs`        | Follow logs of all services                                         |
| `npm run deps`        | Rebuild after a `package.json` change and refresh `node_modules`    |
| `npm run db:generate` | Create a migration after editing `backend/src/database/schema.ts`   |
| `npm run db:migrate`  | Apply pending migrations                                            |
| `npm run db:seed`     | Upsert the starter quest catalog (safe to re-run)                   |
| `npm run db:psql`     | Open `psql` inside the Postgres container                           |
| `npm run db:studio`   | Open Drizzle Studio (needs `npm install` in `backend/` on the host) |

### Adding a dependency

Containers keep their own Linux `node_modules`, separate from the host. After installing a
package (`cd frontend && npm i some-package`), run `npm run deps` so the container picks it up.
