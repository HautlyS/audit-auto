import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(() => {
  const rootDir = process.cwd()
  const statsPath = join(rootDir, 'data', 'pipeline-stats.json')
  
  if (existsSync(statsPath)) {
    try {
      return JSON.parse(readFileSync(statsPath, 'utf-8'))
    } catch (e) {
      console.error('Error reading pipeline stats:', e)
    }
  }
  
  return null
})
