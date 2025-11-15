#!/bin/bash
set -euo pipefail  # Exit on error

echo "🚀 Starting deployment..."

# Step 0: Build frontend
echo "🏗️ Building frontend..."
npm run build

# Step 1: Clean up orphaned staging schema
echo "🧹 Cleaning up staging schema..."
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS drizzle__stage CASCADE;" 2>/dev/null || true

# Step 2: Check if database already has tables (from previous db:push)
echo "🔍 Checking database state..."
TABLE_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('guild_settings', 'economy', 'items');" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -ge "2" ]; then
  # Database has tables - backfill journal to mark baseline as applied
  echo "✅ Existing database detected - backfilling migration journal..."
  psql $DATABASE_URL << 'SQL'
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO "__drizzle_migrations" (hash, created_at)
VALUES ('44a7ddde0269798ed3239f8b704d7f041c721f57fdbc1420e3be9a14a0bcb4c2', 1762608056579)
ON CONFLICT DO NOTHING;
SQL
else
  echo "📦 Fresh database detected - migrations will create schema..."
fi

# Step 3: Run migrations
echo "📊 Running migrations..."
npx drizzle-kit migrate

# Step 4: Start server
echo "🎯 Starting server..."
tsx server/index.ts
