#!/usr/bin/env node

/**
 * Audit Runner - Executes website audits using opencode CLI headless mode
 * 
 * Usage: node scripts/audit-runner.mjs [--target <name>] [--all] [--region <us|eu>]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import toml from 'toml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Load configuration
const config = toml.parse(readFileSync(join(ROOT_DIR, 'config.toml'), 'utf-8'));

// Load targets
function loadTargets(region = null) {
  const targets = [];
  const files = ['targets-us.toml', 'targets-eu.toml', 'targets-ngos.toml'];
  
  for (const file of files) {
    const filePath = join(ROOT_DIR, 'data', file);
    if (existsSync(filePath)) {
      const data = toml.parse(readFileSync(filePath, 'utf-8'));
      if (data.targets) {
        for (const target of data.targets) {
          if (!region || target.region === region || target.region === 'international') {
            targets.push(target);
          }
        }
      }
    }
  }
  
  // Remove duplicates by URL
  const seen = new Set();
  return targets.filter(t => {
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });
}

// Run opencode audit for a single site
async function runAudit(target) {
  const prompt = `You are a professional website auditor. Analyze the website at ${target.url} and provide a comprehensive audit report.

Audit the following categories:
1. ACCESSIBILITY (WCAG 2.1 AA compliance)
   - Missing alt text on images
   - Color contrast issues
   - Keyboard navigation problems
   - Missing ARIA labels
   - Screen reader compatibility
   - Focus indicators

2. SEO ANALYSIS
   - Meta tags (title, description, keywords)
   - Heading structure (H1-H6)
   - Internal/external links
   - Image optimization
   - Mobile responsiveness
   - Page speed indicators
   - Schema markup

3. PERFORMANCE
   - Page load indicators
   - Resource optimization
   - Caching headers
   - Compression
   - Third-party scripts

4. SECURITY
   - HTTPS implementation
   - Security headers (CSP, X-Frame-Options, etc.)
   - Mixed content
   - Cookie policies

Return your analysis as a structured JSON object with this exact format:
{
  "url": "${target.url}",
  "name": "${target.name}",
  "type": "${target.type}",
  "region": "${target.region}",
  "category": "${target.category}",
  "timestamp": "ISO-8601",
  "scores": {
    "accessibility": 0-100,
    "seo": 0-100,
    "performance": 0-100,
    "security": 0-100,
    "overall": 0-100
  },
  "issues": {
    "accessibility": [{"severity": "critical|high|medium|low", "description": "", "element": "", "fix": ""}],
    "seo": [{"severity": "critical|high|medium|low", "description": "", "fix": ""}],
    "performance": [{"severity": "critical|high|medium|low", "description": "", "fix": ""}],
    "security": [{"severity": "critical|high|medium|low", "description": "", "fix": ""}]
  },
  "recommendations": ["top 5 prioritized fixes"],
  "summary": "brief executive summary"
}

IMPORTANT: Return ONLY the JSON, no other text.`;

  try {
    console.log(`\n🔍 Auditing: ${target.name} (${target.url})`);
    
    const result = execSync(
      `opencode -p "${prompt.replace(/"/g, '\\"')}" -f json`,
      {
        encoding: 'utf-8',
        timeout: config.audit.timeout * 1000,
        cwd: ROOT_DIR,
        env: { ...process.env, OPENCODE_MODEL: config.opencode.model }
      }
    );
    
    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const auditResult = JSON.parse(jsonMatch[0]);
      console.log(`✅ Completed: ${target.name} - Overall Score: ${auditResult.scores.overall}`);
      return auditResult;
    } else {
      console.error(`❌ Failed to parse response for ${target.name}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error auditing ${target.name}: ${error.message}`);
    return null;
  }
}

// Save audit result to TOML
function saveAuditResult(result) {
  const auditDir = join(ROOT_DIR, config.storage.audits_dir);
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${result.type}-${result.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.toml`;
  const filepath = join(auditDir, filename);
  
  const tomlContent = `
[audit]
url = "${result.url}"
name = "${result.name}"
type = "${result.type}"
region = "${result.region}"
category = "${result.category}"
timestamp = "${result.timestamp}"

[scores]
accessibility = ${result.scores.accessibility}
seo = ${result.scores.seo}
performance = ${result.scores.performance}
security = ${result.scores.security}
overall = ${result.scores.overall}

[issues.accessibility]
count = ${result.issues.accessibility?.length || 0}

[issues.seo]
count = ${result.issues.seo?.length || 0}

[issues.performance]
count = ${result.issues.performance?.length || 0}

[issues.security]
count = ${result.issues.security?.length || 0}

[summary]
text = "${result.summary?.replace(/"/g, '\\"') || 'No summary available'}"
`.trim();
  
  writeFileSync(filepath, tomlContent);
  console.log(`💾 Saved: ${filename}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const targetName = args.find((_, i, a) => a[i-1] === '--target');
  const allFlag = args.includes('--all');
  const region = args.find((_, i, a) => a[i-1] === '--region');
  
  console.log('🚀 Audit-Auto Audit Runner');
  console.log('========================\n');
  
  let targets = loadTargets(region);
  
  if (targetName) {
    targets = targets.filter(t => t.name.toLowerCase().includes(targetName.toLowerCase()));
  } else if (!allFlag) {
    // Limit to max_sites from config
    targets = targets.slice(0, config.schedule.max_sites);
  }
  
  console.log(`📊 Found ${targets.length} targets to audit`);
  
  const results = [];
  for (const target of targets) {
    const result = await runAudit(target);
    if (result) {
      results.push(result);
      saveAuditResult(result);
    }
  }
  
  // Save summary
  const summaryPath = join(ROOT_DIR, 'data', 'latest-audit-summary.json');
  writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTargets: targets.length,
    completedAudits: results.length,
    averageScores: {
      accessibility: results.length ? Math.round(results.reduce((a, r) => a + r.scores.accessibility, 0) / results.length) : 0,
      seo: results.length ? Math.round(results.reduce((a, r) => a + r.scores.seo, 0) / results.length) : 0,
      performance: results.length ? Math.round(results.reduce((a, r) => a + r.scores.performance, 0) / results.length) : 0,
      security: results.length ? Math.round(results.reduce((a, r) => a + r.scores.security, 0) / results.length) : 0,
    }
  }, null, 2));
  
  console.log('\n✅ Audit cycle complete!');
  console.log(`📊 Results: ${results.length}/${targets.length} sites audited`);
}

main().catch(console.error);
