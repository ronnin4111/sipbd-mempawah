import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  // Auto-detect Turso usage:
  // 1. If USE_TURSO=true is explicitly set
  // 2. OR if we're in production (Vercel) and Turso credentials are available
  //    (Vercel can't use local SQLite files, so Turso is required)
  const isVercel = !!process.env.VERCEL
  const useTurso =
    process.env.USE_TURSO === 'true' ||
    (isVercel && !!tursoUrl && !!tursoToken) ||
    (process.env.NODE_ENV === 'production' && !!tursoUrl && !!tursoToken)

  if (useTurso && tursoUrl && tursoToken) {
    // Dynamic import to avoid bundling issues on local dev without Turso packages
    const { PrismaLibSql } = require('@prisma/adapter-libsql')
    const adapter = new PrismaLibSql({ url: tursoUrl, authToken: tursoToken })
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  }

  // Default: use local SQLite (for local development)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
