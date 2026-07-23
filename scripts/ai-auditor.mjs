#!/usr/bin/env node

/**
 * AI Auditor - Uses OpenCode CLI headless mode for deep website analysis
 * Processes scraped data and generates comprehensive audit reports
 * 
 * Usage: node scripts/ai-auditor.mjs [--input <file>] [--all]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Configuration
const CONFIG = {
  model: process.env.OPENCODE_MODEL || 'opencode/mimo-v2.5-free',
  maxConcurrent: 1,
  timeout: 60000,
  retryAttempts: 2
};

// Audit prompt template
function buildAuditPrompt(target, scrapedData) {
  return `Analyze this website data and provide a brief audit:

Website: ${target.name} (${target.url})
Type: ${target.type} | Region: ${target.region}

Data:
- Title: ${scrapedData.title || 'N/A'}
- Meta: ${scrapedData.description || 'N/A'}
- H1 Tags: ${scrapedData.seo?.h1Count || 0}
- Images w/o Alt: ${scrapedData.seo?.imagesWithoutAlt || 0}
- HTTPS: ${scrapedData.security?.isHttps ? 'Yes' : 'No'}
- Scripts: ${scrapedData.performance?.scripts || 0}
- ARIA Landmarks: ${scrapedData.accessibility?.ariaLandmarks || 0}

Score each category 0-100 and list top 3 issues:
- Accessibility (WCAG 2.1)
- SEO
- Performance
- Security

Return as JSON:
{"scores":{"accessibility":85,"seo":90,"performance":75,"security":95,"overall":86},"issues":{"accessibility":["issue1"],"seo":["issue1"],"performance":["issue1"],"security":["issue1"]},"summary":"Brief summary"}`;
}

// Run OpenCode CLI audit
function runOpenCodeAudit(prompt) {
  try {
    // Escape the prompt for shell
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, ' ');
    
    const result = execSync(
      `opencode run -m ${CONFIG.model} "${escapedPrompt}"`,
      {
        encoding: 'utf-8',
        timeout: CONFIG.timeout,
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    
    return result;
  } catch (error) {
    throw new Error(`OpenCode error: ${error.message}`);
  }
}

// Parse JSON from response
function extractJSON(response) {
  // Try to find JSON in the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Try to fix common JSON issues
      let fixed = jsonMatch[0]
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      
      try {
        return JSON.parse(fixed);
      } catch (e2) {
        return null;
      }
    }
  }
  return null;
}

// Audit a single site
async function auditSite(target) {
  console.log(`  🤖 AI Auditing: ${target.name}`);
  
  const prompt = buildAuditPrompt(target, target);
  
  for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
    try {
      const response = runOpenCodeAudit(prompt);
      const auditResult = extractJSON(response);
      
      if (auditResult) {
        // Merge with original data
        const fullResult = {
          ...target,
          scores: auditResult.scores || target.scores,
          issues: auditResult.issues || {},
          summary: auditResult.summary || '',
          aiAuditTimestamp: new Date().toISOString()
        };
        
        console.log(`  ✅ Done: ${target.name} - Score: ${fullResult.scores?.overall || 'N/A'}`);
        return fullResult;
      } else {
        console.log(`  ⚠️  Attempt ${attempt}: Failed to parse response for ${target.name}`);
      }
    } catch (error) {
      console.log(`  ⚠️  Attempt ${attempt}: Error for ${target.name}: ${error.message}`);
    }
    
    if (attempt < CONFIG.retryAttempts) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`  ❌ Failed: ${target.name} after ${CONFIG.retryAttempts} attempts`);
  return target; // Return original data if AI fails
}

// Save audit result
function saveAuditResult(result) {
  const auditDir = join(ROOT_DIR, 'audits');
  mkdirSync(auditDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${result.type || 'unknown'}-${(result.name || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${timestamp}.toml`;
  const filepath = join(auditDir, filename);
  
  const tomlContent = `[audit]
url = "${result.url || ''}"
name = "${result.name || ''}"
type = "${result.type || ''}"
region = "${result.region || ''}"
category = "${result.category || ''}"
timestamp = "${result.scrapedAt || result.aiAuditTimestamp || new Date().toISOString()}"

[scores]
accessibility = ${result.scores?.accessibility || 0}
seo = ${result.scores?.seo || 0}
performance = ${result.scores?.performance || 0}
security = ${result.scores?.security || 0}
overall = ${result.scores?.overall || 0}

[summary]
text = "${(result.summary || 'No summary').replace(/"/g, '\\"').replace(/\n/g, ' ')}"
`;
  
  writeFileSync(filepath, tomlContent);
  console.log(`  💾 Saved: ${filename}`);
}

// Load scraped data
function loadScrapedData() {
  const latestPath = join(ROOT_DIR, 'data', 'latest-scrape-results.json');
  if (existsSync(latestPath)) {
    const data = JSON.parse(readFileSync(latestPath, 'utf-8'));
    return data.results || [];
  }
  return [];
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const allFlag = args.includes('--all');
  
  console.log('🤖 Autit-Auto AI Auditor');
  console.log('========================\n');
  
  // Load scraped data
  const scrapedData = loadScrapedData();
  
  if (scrapedData.length === 0) {
    console.log('❌ No scraped data found. Run full-scraper.mjs first.');
    return;
  }
  
  console.log(`📊 Found ${scrapedData.length} targets to audit\n`);
  
  const limit = pLimit(CONFIG.maxConcurrent);
  const results = [];
  
  // Process targets sequentially (AI calls are slow)
  for (const target of scrapedData) {
    const result = await auditSite(target);
    results.push(result);
    saveAuditResult(result);
  }
  
  // Generate summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalTargets: scrapedData.length,
    completedAudits: results.length,
    averageScores: {
      accessibility: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.accessibility || 0), 0) / results.length) : 0,
      seo: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.seo || 0), 0) / results.length) : 0,
      performance: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.performance || 0), 0) / results.length) : 0,
      security: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.security || 0), 0) / results.length) : 0,
      overall: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.overall || 0), 0) / results.length) : 0
    }
  };
  
  // Save summary
  const summaryPath = join(ROOT_DIR, 'data', 'latest-audit-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  
  console.log('\n========================');
  console.log('✅ AI Audit cycle complete!');
  console.log(`📊 Results: ${results.length}/${scrapedData.length} sites audited`);
  console.log(`📈 Average Overall Score: ${summary.averageScores.overall}`);
}

main().catch(console.error);
