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

| Script                | What it does                                                                      |
| --------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`         | Build images and start the whole stack (logs in the foreground)                   |
| `npm run down`        | Stop and remove the containers (DB data is kept)                                  |
| `npm run logs`        | Follow logs of all services                                                       |
| `npm run deps`        | Rebuild after a `package.json` change and refresh `node_modules` (the DB is kept) |
| `npm run db:generate` | Create a migration after editing `backend/src/database/schema.ts`                 |
| `npm run db:migrate`  | Apply pending migrations                                                          |
| `npm run db:seed`     | Upsert the starter quest catalog (safe to re-run)                                 |
| `npm run db:psql`     | Open `psql` inside the Postgres container                                         |
| `npm run db:studio`   | Open Drizzle Studio (needs `npm install` in `backend/` on the host)               |

### Adding a dependency

Containers keep their own Linux `node_modules` in named volumes, separate from the host, so
`docker compose down` / `up` don't copy them again. After installing a package
(`cd frontend && npm i some-package`) or pulling a `package.json` change, run `npm run deps`:
it recreates those volumes so the containers pick the new packages up.

## Deploy

Production runs on two services under one domain, so the session cookie (`SameSite=Lax`) works:

| What     | Where            | Address                     |
| -------- | ---------------- | --------------------------- |
| Frontend | Cloudflare Pages | `https://inkquests.xyz`     |
| Backend  | Railway (Docker) | `https://api.inkquests.xyz` |
| Database | Railway Postgres | private network only        |

Every push to `main` redeploys both. Each backend deploy applies pending migrations and re-applies
the quest catalog from `seed.ts` before the API starts (see `backend/Dockerfile`).

### Backend on Railway

1. New project → **Deploy from GitHub repo** → this repo.
2. In the service **Settings**, set **Root Directory** to `backend`. The build and health check come
   from `backend/railway.json` (`Dockerfile`, `GET /health`); if Railway doesn't pick it up, set
   **Config file path** to `/backend/railway.json`.
3. In the same project, **+ New → Database → PostgreSQL**.
4. Service **Variables**:

   | Variable           | Value                                                            |
   | ------------------ | ---------------------------------------------------------------- |
   | `DATABASE_URL`     | `${{Postgres.DATABASE_URL}}` (reference to the database above)   |
   | `FRONTEND_ORIGIN`  | `https://inkquests.xyz`                                          |
   | `EXPLORER_API_KEY` | Blockscout PRO key (dev.blockscout.com)                          |
   | `TRUST_PROXY_HOPS` | `1` (Railway's proxy), so rate limits see the client IP          |
   | `INK_RPC_URL`      | Recommended: a dedicated Ink RPC (the public one rate-limits)    |
   | `X_CLIENT_ID`      | X OAuth 2.0 app (developer.x.com), for linking X accounts        |
   | `X_CLIENT_SECRET`  | Its client secret                                                |
   | `X_REDIRECT_URI`   | `https://api.inkquests.xyz/auth/x/callback` (the app's callback) |

   `PORT` is set by Railway.

5. **Settings → Networking → Custom Domain** → `api.inkquests.xyz`. Railway shows a CNAME target;
   add it in Cloudflare **DNS** as `CNAME api → <target>`, proxy status **DNS only**.

### Frontend on Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git** → this repo.
2. Build settings: root directory `frontend`, build command `npm run build`, output directory
   `dist`.
3. **Environment variables** (Production), read at build time, so redeploy after changing them:

   | Variable                        | Value                                |
   | ------------------------------- | ------------------------------------ |
   | `VITE_API_URL`                  | `https://api.inkquests.xyz`          |
   | `VITE_WALLETCONNECT_PROJECT_ID` | Reown project id                     |
   | `NODE_VERSION`                  | `24` (Vite 8 needs a recent Node.js) |

4. **Custom domains** → `inkquests.xyz`. Also add `www.inkquests.xyz` and redirect it to the apex
   (Cloudflare **Rules → Redirect Rules**): the API only allows `https://inkquests.xyz` via CORS.
5. On dashboard.reown.com, add `https://inkquests.xyz` to the project's domain allowlist.

Pages serves `index.html` for unknown paths, so direct links like `/leaderboard` work.

### After the first deploy

- `https://api.inkquests.xyz/health` → `{"status":"ok","db":"up"}`.
- Open `https://inkquests.xyz`, connect a wallet, sign in, check in.
- Turn on backups for the Railway Postgres database.
