import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Turso database configuration
// IMPORTANT: Credentials must be provided via environment variables.
// Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your .env file.
const TURSO_CONFIG = {
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || ''

  // Auto-detect database type from DATABASE_URL:
  // - "libsql://" or "https://" → Turso (remote)
  // - "file:" → Local SQLite (development)
  const isTursoUrl = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://')
  const isLocalFile = databaseUrl.startsWith('file:')
  const isVercel = !!process.env.VERCEL

  // Priority 1: Explicit Turso env vars (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
  // This takes precedence over local file: so dev sandbox can use Turso
  if (TURSO_CONFIG.url && TURSO_CONFIG.authToken && !isTursoUrl) {
    const url = TURSO_CONFIG.url
    const authToken = TURSO_CONFIG.authToken
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const adapterModule = require('@prisma/adapter-libsql')
      const PrismaLibSqlAdapter = adapterModule.PrismaLibSQL || adapterModule.PrismaLibSql
      if (PrismaLibSqlAdapter) {
        const adapter = new PrismaLibSqlAdapter({ url, authToken })
        return new PrismaClient({
          adapter,
          log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        })
      }
    } catch (err) {
      console.error('Failed to initialize Turso adapter (priority):', err)
      // Fall through to local fallback
    }
  }

  // Priority 2: DATABASE_URL is libsql:// (explicit Turso URL with token embedded)
  if (isTursoUrl) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const adapterModule = require('@prisma/adapter-libsql')
      const PrismaLibSqlAdapter = adapterModule.PrismaLibSQL || adapterModule.PrismaLibSql
      if (PrismaLibSqlAdapter) {
        const adapter = new PrismaLibSqlAdapter({ url: databaseUrl })
        return new PrismaClient({
          adapter,
          log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        })
      }
    } catch (err) {
      console.error('Failed to initialize Turso adapter (from DATABASE_URL):', err)
    }
  }

  // Priority 3: Local SQLite file (development fallback)
  if (isLocalFile && !isVercel) {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  }

  // Priority 4: Vercel with Turso env vars
  const url = TURSO_CONFIG.url
  const authToken = TURSO_CONFIG.authToken

  if (url && authToken) {
    try {
      // Dynamic require to handle export name differences across package versions
      // Some versions export PrismaLibSQL (uppercase SQL), others PrismaLibSql (lowercase ql)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const adapterModule = require('@prisma/adapter-libsql')
      const PrismaLibSqlAdapter = adapterModule.PrismaLibSQL || adapterModule.PrismaLibSql
      if (PrismaLibSqlAdapter) {
        const adapter = new PrismaLibSqlAdapter({ url, authToken })
        return new PrismaClient({
          adapter,
          log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        })
      }
    } catch (err) {
      console.error('Failed to initialize Turso adapter:', err)
      throw new Error(
        'Turso adapter initialization failed. Make sure @prisma/adapter-libsql is installed.'
      )
    }
  }

  // Fallback: try default SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
