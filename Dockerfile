# ============================================================
# Stage 1: Build frontend (React SPA)
# ============================================================
FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install && npm cache clean --force
COPY frontend/ ./
RUN npm run build

# ============================================================
# Stage 2: Build backend (Express API)
# ============================================================
FROM node:20-bookworm-slim AS backend-builder

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package*.json ./
RUN npm install && npm cache clean --force
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ============================================================
# Stage 3: Production runtime image
# ============================================================
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled backend
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/prisma ./prisma

# Copy built frontend → served as static files by backend
COPY --from=frontend-builder /app/dist ./public

# Create data directory for SQLite persistence
RUN mkdir -p /data

# Environment defaults (override at runtime)
ENV PORT=3000
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/dev.db"

# Expose application port
EXPOSE 3000

# Use tini as init for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Generate Prisma client (for target arch) and start server
CMD npx prisma generate --schema=./prisma/schema.prisma && \
    node dist/index.js
