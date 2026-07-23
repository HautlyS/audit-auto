import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import toml from 'toml'

export default defineEventHandler(() => {
  const rootDir = process.cwd()
  const configPath = join(rootDir, 'config.toml')
  
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, 'utf-8')
    return toml.parse(content)
  }
  
  return {
    schedule: {
      cron: '0 */2 * * *',
      max_sites: 50
    },
    audit: {
      categories: ['accessibility', 'seo', 'performance', 'security']
    }
  }
})
