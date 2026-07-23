import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import toml from 'toml'

const cache = new Map<string, { data: any, timestamp: number }>()
const CACHE_TTL = 60000

export default defineEventHandler(async () => {
  const rootDir = process.cwd()
  const auditsDir = join(rootDir, 'audits')
  
  const cacheKey = 'dashboard'
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  
  const audits: any[] = []
  
  if (existsSync(auditsDir)) {
    try {
      const files = (await readdir(auditsDir)).filter(f => f.endsWith('.toml'))
      
      for (const file of files) {
        try {
          const content = await readFile(join(auditsDir, file), 'utf-8')
          const data = toml.parse(content)
          audits.push(data.audit || data)
        } catch (e) {
          console.error(`Error parsing ${file}:`, e)
        }
      }
    } catch (e) {
      console.error('Error reading audits directory:', e)
    }
  }
  
  const summary = {
    totalAudits: audits.length,
    averageScores: {
      accessibility: 0,
      seo: 0,
      performance: 0,
      security: 0,
      overall: 0
    },
    criticalIssues: 0,
    highIssues: 0
  }
  
  if (audits.length > 0) {
    const totals = audits.reduce((acc, a) => ({
      accessibility: acc.accessibility + (a.scores?.accessibility || 0),
      seo: acc.seo + (a.scores?.seo || 0),
      performance: acc.performance + (a.scores?.performance || 0),
      security: acc.security + (a.scores?.security || 0),
      overall: acc.overall + (a.scores?.overall || 0)
    }), { accessibility: 0, seo: 0, performance: 0, security: 0, overall: 0 })
    
    Object.keys(summary.averageScores).forEach(key => {
      summary.averageScores[key as keyof typeof summary.averageScores] = Math.round(totals[key as keyof typeof totals] / audits.length)
    })
  }
  
  const result = {
    generatedAt: new Date().toISOString(),
    summary,
    recentAudits: audits.slice(-20).reverse(),
    allAudits: audits
  }
  
  cache.set(cacheKey, { data: result, timestamp: Date.now() })
  
  return result
})
