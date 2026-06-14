#!/usr/bin/env node
/**
 * Push Prisma schema to database.
 * On Vercel/Turso: uses TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 * On local: uses DATABASE_URL (SQLite file)
 */
const { execSync } = require('child_process');
const path = require('path');

function main() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const databaseUrl = process.env.DATABASE_URL;

  if (tursoUrl && tursoToken) {
    console.log('🔑 Detected Turso config - pushing schema to Turso...');
    // Clean URL and add auth token
    const cleanUrl = tursoUrl.replace(/\?.*/, '').replace(/\/$/, '');
    const fullUrl = `${cleanUrl}?authToken=${tursoToken}`;
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: fullUrl },
    });
    console.log('✅ Schema pushed to Turso successfully');
  } else if (databaseUrl) {
    console.log('📦 Using DATABASE_URL - pushing schema...');
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
    });
    console.log('✅ Schema pushed successfully');
  } else {
    console.log('⚠️ No database URL configured - skipping schema push');
  }
}

main();
