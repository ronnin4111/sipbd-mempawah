import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || ''
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN
  const tursoUrl = process.env.TURSO_DATABASE_URL

  // Determine if we should use Turso (remote) or local SQLite
  // Strategy:
  // 1. If DATABASE_URL is a Turso URL (libsql://, https://) → always use Turso
  // 2. If DATABASE_URL is a local file AND we're on Vercel → use TURSO_DATABASE_URL as fallback
  // 3. If DATABASE_URL is a local file AND we're NOT on Vercel → use local SQLite

  const isTursoUrl = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://')
  const isLocalFile = databaseUrl.startsWith('file:')
  const isVercel = !!process.env.VERCEL
  const hasTursoConfig = !!(tursoUrl && tursoAuthToken)

  // Use Turso if:
  // - DATABASE_URL directly points to Turso, OR
  // - We're on Vercel with Turso credentials available (Vercel can't use local SQLite files)
  const useTurso = isTursoUrl || (isLocalFile && isVercel && hasTursoConfig)

  if (useTurso && hasTursoConfig) {
    const url = isTursoUrl ? databaseUrl : tursoUrl!
    try {
      const { PrismaLibSql } = require('@prisma/adapter-libsql')
      const adapter = new PrismaLibSql({ url, authToken: tursoAuthToken! })
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
  }

  // Default: use local SQLite (for local development)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

