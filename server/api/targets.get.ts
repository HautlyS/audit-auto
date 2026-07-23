import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import toml from 'toml'

export default defineEventHandler(() => {
  const rootDir = process.cwd()
  const targets = []
  
  const files = [
    'data/targets-us.toml',
    'data/targets-eu.toml',
    'data/targets-ngos.toml'
  ]
  
  for (const file of files) {
    const filePath = join(rootDir, file)
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const data = toml.parse(content)
        if (data.targets) {
          targets.push(...data.targets)
        }
      } catch (e) {
        console.error(`Error parsing ${file}:`, e)
      }
    }
  }
  
  // Remove duplicates by URL
  const seen = new Set()
  const uniqueTargets = targets.filter(t => {
    if (seen.has(t.url)) return false
    seen.add(t.url)
    return true
  })
  
  return uniqueTargets
})
