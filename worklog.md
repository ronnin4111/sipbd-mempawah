---
Task ID: 1
Agent: Main Agent
Task: Deploy SIPBD Mempawah to Turso database

Work Log:
- Cloned repo from ronnin4111/sipbd-mempawah to /home/z/my-project
- Installed dependencies with bun install (867 packages)
- Installed Turso CLI and verified connectivity
- Installed @prisma/adapter-libsql and @libsql/client
- Updated .env with TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
- Created FishFarm and CommodityPrice tables on Turso via libsql client
- Migrated 483 FishFarm records from local SQLite to Turso
- Updated prisma/schema.prisma (removed deprecated previewFeatures)
- Updated src/lib/db.ts to use PrismaLibSql adapter with Turso
- Updated prisma/seed.ts to use Turso adapter
- Fixed PrismaLibSQL -> PrismaLibSql export name issue
- Fixed URL_INVALID error by keeping DATABASE_URL as local SQLite path (for Prisma internal validation) and using TURSO_DATABASE_URL for actual Turso connection
- Added allowedDevOrigins config in next.config.ts for preview panel
- All API routes verified working: fish-farms, stats, years, commodity-prices

Stage Summary:
- Database successfully migrated from local SQLite to Turso (libsql://sipbd-mempawah-ronnin4111.aws-ap-northeast-1.turso.io)
- 483 FishFarm records migrated
- All API endpoints return 200 OK with Turso data
- Dev server running on port 3000 with auto-restart
