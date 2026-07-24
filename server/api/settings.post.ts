import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  const rootDir = process.cwd()
  const settingsPath = join(rootDir, 'data', 'settings.json')
  
  mkdirSync(join(rootDir, 'data'), { recursive: true })
  
  writeFileSync(settingsPath, JSON.stringify(body, null, 2))
  
  return { success: true }
})
