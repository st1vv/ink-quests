# Production image (Railway). Local development uses Dockerfile.dev.
# No BuildKit cache mounts here: Railway only accepts them with an id tied
# to the service; it caches the layers itself.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
USER node
EXPOSE 3000
# Every deploy migrates, then re-applies the quest catalog from seed.ts
# (idempotent), then starts the API.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/database/seed.js && node dist/main.js"]
