import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Turso database configuration
// Environment variables take precedence, with embedded fallback for Vercel deployment
const TURSO_CONFIG = {
  url: process.env.TURSO_DATABASE_URL || 'libsql://sipbd-mempawah-ronnin4111.aws-ap-northeast-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE3ODA2NTI0MDIsImlhdCI6MTc3ODA2MDQwMiwiaWQiOiIwMTlkZmNhNy0wYTAxLTc2NTYtODhhZC0zMjBiNTVjM2ZmYjYiLCJyaWQiOiIyYWI1NjA2ZC1kMzJhLTQ0MmItYTU5MC0xNWQzYjljOTc1YmIifQ.zGrpac_GfYS-ZPaCaU4T-vG2LeKdci0CVGZ52JMoYWkJLJB0oC5ELPDksVbPAS8Ca07vcWu0tA9WXT2kp5cvCQ',
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || ''

  // Auto-detect database type from DATABASE_URL:
  // - "file:" → Local SQLite (development)
  // - "libsql://" or "https://" → Turso (remote)
  // - On Vercel without explicit libsql URL → use embedded Turso config
  const isTursoUrl = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://')
  const isLocalFile = databaseUrl.startsWith('file:')
  const isVercel = !!process.env.VERCEL

  // Use local SQLite for local development
  if (isLocalFile && !isVercel) {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  }

  // Use Turso for production/Vercel
  const url = isTursoUrl ? databaseUrl : TURSO_CONFIG.url
  const authToken = process.env.TURSO_AUTH_TOKEN || TURSO_CONFIG.authToken

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
