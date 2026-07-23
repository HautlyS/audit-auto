import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const cache = new Map<string, { data: any, timestamp: number }>()
const CACHE_TTL = 60000

export default defineEventHandler(async () => {
  const cacheKey = 'dashboard'
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const rootDir = process.cwd()
  const dashboardPath = join(rootDir, 'data', 'dashboard-data.json')

  if (existsSync(dashboardPath)) {
    try {
      const content = await readFile(dashboardPath, 'utf-8')
      const data = JSON.parse(content)
      cache.set(cacheKey, { data, timestamp: Date.now() })
      return data
    } catch (e) {
      console.error('Error reading dashboard-data.json:', e)
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalAudits: 0,
      totalTargetsInRegistry: 0,
      totalKnownTargets: 0,
      averageScores: { accessibility: 0, seo: 0, performance: 0, security: 0, overall: 0 },
      totalIssues: 0,
      uniqueSitesWithHistory: 0
    },
    byType: { enterprise: [], ngo: [] },
    byRegion: { us: [], eu: [], international: [] },
    recentAudits: [],
    allAudits: [],
    scoreTrends: [],
    registry: {}
  }
})
