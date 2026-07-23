import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import toml from 'toml'

export default defineEventHandler(() => {
  const rootDir = process.cwd()
  const auditsDir = join(rootDir, 'audits')
  
  const audits = []
  
  if (existsSync(auditsDir)) {
    const files = readdirSync(auditsDir).filter(f => f.endsWith('.toml'))
    
    for (const file of files) {
      try {
        const content = readFileSync(join(auditsDir, file), 'utf-8')
        const data = toml.parse(content)
        audits.push(data.audit || data)
      } catch (e) {
        console.error(`Error parsing ${file}:`, e)
      }
    }
  }
  
  // Calculate summary stats
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
      summary.averageScores[key] = Math.round(totals[key] / audits.length)
    })
  }
  
  return {
    generatedAt: new Date().toISOString(),
    summary,
    recentAudits: audits.slice(-20).reverse(),
    allAudits: audits
  }
})
