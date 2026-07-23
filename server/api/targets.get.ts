import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const cache = new Map<string, { data: any, timestamp: number }>()
const CACHE_TTL = 60000

export default defineEventHandler(async () => {
  const cacheKey = 'targets'
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const rootDir = process.cwd()
  const knownPath = join(rootDir, 'data', 'known-targets.json')

  if (existsSync(knownPath)) {
    try {
      const content = await readFile(knownPath, 'utf-8')
      const targets = JSON.parse(content)
      const result = targets.map((t: any) => ({
        name: t.name,
        url: t.url,
        type: t.type || 'enterprise',
        region: t.region || 'international',
        category: t.category || 'general',
        discoveredAt: t.discoveredAt,
        lastSeenAt: t.lastSeenAt
      }))
      cache.set(cacheKey, { data: result, timestamp: Date.now() })
      return result
    } catch (e) {
      console.error('Error reading known-targets.json:', e)
    }
  }

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
        const matches = content.matchAll(/\[\[targets\]\][\s\S]*?(?=\[\[targets\]\]|$)/g)
        for (const match of matches) {
          const block = match[0]
          const name = block.match(/name\s*=\s*"([^"]+)"/)?.[1]
          const url = block.match(/url\s*=\s*"([^"]+)"/)?.[1]
          const type = block.match(/type\s*=\s*"([^"]+)"/)?.[1]
          const region = block.match(/region\s*=\s*"([^"]+)"/)?.[1]
          const category = block.match(/category\s*=\s*"([^"]+)"/)?.[1]
          if (name && url) {
            targets.push({ name, url, type, region, category })
          }
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
