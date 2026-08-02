FROM node:20-bookworm-slim AS base

# build tools as a fallback in case better-sqlite3 has no prebuilt binary
# for this exact platform/arch (avoids the Nixpacks "no Python" failure)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# SQLite data lives here; mount a persistent disk at this path
# (Fly.io volume or Render persistent disk) so data survives redeploys
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/app.js"]
