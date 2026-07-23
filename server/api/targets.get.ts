import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import toml from 'toml'

const cache = new Map<string, { data: any, timestamp: number }>()
const CACHE_TTL = 60000

export default defineEventHandler(async () => {
  const cacheKey = 'targets'
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  
  const rootDir = process.cwd()
  const targets: any[] = []
  
  const files = [
    'data/targets-us.toml',
    'data/targets-eu.toml',
    'data/targets-ngos.toml'
  ]
  
  for (const file of files) {
    const filePath = join(rootDir, file)
    if (existsSync(filePath)) {
      try {
        const content = await readFile(filePath, 'utf-8')
        const data = toml.parse(content)
        if (data.targets) {
          targets.push(...data.targets)
        }
      } catch (e) {
        console.error(`Error parsing ${file}:`, e)
      }
    }
  }
  
  const seen = new Set()
  const uniqueTargets = targets.filter(t => {
    if (seen.has(t.url)) return false
    seen.add(t.url)
    return true
  })
  
  cache.set(cacheKey, { data: uniqueTargets, timestamp: Date.now() })
  
  return uniqueTargets
})
