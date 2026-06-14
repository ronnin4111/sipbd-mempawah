#!/bin/bash
# Push Prisma schema to database
# On Vercel/Turso: uses TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
# On local: uses DATABASE_URL (SQLite file)

set -e

# Check if we're on Vercel with Turso
if [ -n "$TURSO_DATABASE_URL" ] && [ -n "$TURSO_AUTH_TOKEN" ]; then
  echo "🔑 Detected Turso config - pushing schema to Turso..."
  # Construct DATABASE_URL with auth token for Prisma CLI
  # Remove any trailing slash and query params from TURSO_DATABASE_URL
  CLEAN_URL=$(echo "$TURSO_DATABASE_URL" | sed 's/\?.*//' | sed 's/\/$//')
  DATABASE_URL="${CLEAN_URL}?authToken=${TURSO_AUTH_TOKEN}" npx prisma db push --accept-data-loss --skip-generate
  echo "✅ Schema pushed to Turso successfully"
elif [ -n "$DATABASE_URL" ]; then
  echo "📦 Using DATABASE_URL - pushing schema..."
  npx prisma db push --accept-data-loss --skip-generate
  echo "✅ Schema pushed successfully"
else
  echo "⚠️ No database URL configured - skipping schema push"
fi
