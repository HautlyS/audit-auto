import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(() => {
  const rootDir = process.cwd()
  const settingsPath = join(rootDir, 'data', 'settings.json')
  
  if (existsSync(settingsPath)) {
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf-8'))
    } catch (e) {
      console.error('Error reading settings:', e)
    }
  }
  
  return {
    opencode: {
      model: 'opencode/grok-code',
      apiKey: ''
    },
    github: {
      repository: 'hautlys/audit-auto',
      branch: 'main'
    },
    notifications: {
      email: true,
      slack: false
    }
  }
})
