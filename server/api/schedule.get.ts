import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import toml from 'toml'

export default defineEventHandler(async () => {
  const rootDir = process.cwd()
  const configPath = join(rootDir, 'config.toml')
  
  if (existsSync(configPath)) {
    try {
      const content = await readFile(configPath, 'utf-8')
      return toml.parse(content)
    } catch (e) {
      console.error('Error parsing config.toml:', e)
      throw createError({ statusCode: 500, message: 'Failed to parse configuration' })
    }
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
