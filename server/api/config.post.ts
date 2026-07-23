import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import toml from 'toml'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  const rootDir = process.cwd()
  const configPath = join(rootDir, 'config.toml')
  
  let config: any = {}
  
  if (existsSync(configPath)) {
    try {
      config = toml.parse(readFileSync(configPath, 'utf-8'))
    } catch (e) {
      console.error('Error parsing config:', e)
    }
  }
  
  if (!config.schedule) config.schedule = {}
  if (body.cron) config.schedule.cron = body.cron
  if (body.maxSites) config.schedule.max_sites = body.maxSites
  if (body.enabled !== undefined) config.schedule.enabled = body.enabled
  
  const tomlContent = `[schedule]
cron = "${config.schedule.cron || '0 */2 * * *'}"
max_sites = ${config.schedule.max_sites || 50}
enabled = ${config.schedule.enabled !== false}

[audit]
categories = ${JSON.stringify(config.audit?.categories || ['accessibility', 'seo', 'performance', 'security'])}

[opencode]
model = "${config.opencode?.model || 'opencode/grok-code'}"
timeout = ${config.opencode?.timeout || 120}

[storage]
audits_dir = "${config.storage?.audits_dir || 'audits'}"
data_dir = "${config.storage?.data_dir || 'data'}"

[regions]
us = ${config.regions?.us !== false}
eu = ${config.regions?.eu !== false}
international = ${config.regions?.international || false}

[dashboard]
theme = "${config.dashboard?.theme || 'auto'}"
refresh_interval = ${config.dashboard?.refresh_interval || 30}
`
  
  writeFileSync(configPath, tomlContent)
  
  return { success: true }
})
