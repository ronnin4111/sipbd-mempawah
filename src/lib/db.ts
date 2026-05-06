import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || ''
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN
  const tursoUrl = process.env.TURSO_DATABASE_URL

  // Auto-detect database type from DATABASE_URL:
  // - "file:" → Local SQLite (development)
  // - "libsql://" or "https://" → Turso (remote) - requires TURSO_AUTH_TOKEN
  const isTursoUrl = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://')

  // Use Turso when DATABASE_URL points to Turso OR TURSO_DATABASE_URL is set
  const useTurso = isTursoUrl || (tursoUrl && tursoUrl.startsWith('libsql://'))

  if (useTurso) {
    const url = isTursoUrl ? databaseUrl : tursoUrl!
    if (url && tursoAuthToken) {
      try {
        const { PrismaLibSql } = require('@prisma/adapter-libsql')
        const adapter = new PrismaLibSql({ url, authToken: tursoAuthToken })
        return new PrismaClient({
          adapter,
          log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        })
      } catch (err) {
        console.error('Failed to initialize Turso adapter:', err)
        throw new Error(
          'Turso adapter initialization failed. Make sure @prisma/adapter-libsql is installed.'
        )
      }
    } else if (!tursoAuthToken) {
      console.error('TURSO_AUTH_TOKEN is required when using Turso database URL')
      throw new Error('Missing TURSO_AUTH_TOKEN environment variable')
    }
  }

  // Default: use local SQLite (for local development)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
