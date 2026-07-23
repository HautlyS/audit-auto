#!/usr/bin/env node

import { execFile } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const CONFIG = {
  model: process.env.OPENCODE_MODEL || 'opencode/mimo-v2.5-free',
  timeout: 60000,
  retryAttempts: 2
};

const AUDITS_DIR = join(ROOT_DIR, 'audits');
const SCRAPE_RESULTS_PATH = join(ROOT_DIR, 'data', 'latest-scrape-results.json');
const SCRAPE_HISTORY_PATH = join(ROOT_DIR, 'data', 'scrape-history.json');
const AUDIT_REGISTRY_PATH = join(ROOT_DIR, 'data', 'audit-registry.json');

function loadAuditRegistry() {
  if (existsSync(AUDIT_REGISTRY_PATH)) {
    return JSON.parse(readFileSync(AUDIT_REGISTRY_PATH, 'utf-8'));
  }
  return {};
}

function saveAuditRegistry(registry) {
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
  writeFileSync(AUDIT_REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function loadScrapeHistory() {
  if (existsSync(SCRAPE_HISTORY_PATH)) {
    return JSON.parse(readFileSync(SCRAPE_HISTORY_PATH, 'utf-8'));
  }
  return {};
}

function buildAuditPrompt(target) {
  return `Analyze this website data and provide a brief audit:

Website: ${target.name} (${target.url})
Type: ${target.type} | Region: ${target.region}

Data:
- Title: ${target.title || 'N/A'}
- Meta: ${target.description || 'N/A'}
- H1 Tags: ${target.seo?.h1Count || 0}
- Images w/o Alt: ${target.seo?.imagesWithoutAlt || 0}
- HTTPS: ${target.security?.isHttps ? 'Yes' : 'No'}
- Scripts: ${target.performance?.scripts || 0}
- ARIA Landmarks: ${target.accessibility?.ariaLandmarks || 0}
- Word Count: ${target.content?.wordCount || 0}
- Heading Count: ${target.content?.headings || 0}
- Schema.org: ${target.seo?.schemaOrg ? 'Yes' : 'No'}
- Canonical: ${target.seo?.canonical || 'None'}
- OG Title: ${target.seo?.ogTitle || 'None'}

Score each category 0-100 and list top 3 issues:
- Accessibility (WCAG 2.1)
- SEO
- Performance
- Security

Return as JSON:
{"scores":{"accessibility":85,"seo":90,"performance":75,"security":95,"overall":86},"issues":{"accessibility":["issue1"],"seo":["issue1"],"performance":["issue1"],"security":["issue1"]},"recommendations":["rec1","rec2"],"summary":"Brief summary"}`;
}

async function runOpenCodeAudit(prompt) {
  const proc = execFile('opencode', ['run', '-m', CONFIG.model, '--format', 'json'], {
    encoding: 'utf-8',
    timeout: CONFIG.timeout,
    cwd: ROOT_DIR,
    maxBuffer: 10 * 1024 * 1024
  });

  proc.stdin.write(prompt);
  proc.stdin.end();

  const { stdout } = await new Promise((resolve, reject) => {
    let out = '', err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`opencode exited with code ${code}. Stderr:\n${err}`));
      else resolve({ stdout: out });
    });
  });

  const lines = stdout.trim().split('\n').filter(Boolean);
  const textParts = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === 'text' && event.part?.text) {
        textParts.push(event.part.text);
      }
    } catch { }
  }
  return textParts.join('\n');
}

function extractJSON(response) {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      let fixed = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      try { return JSON.parse(fixed); } catch { return null; }
    }
  }
  return null;
}

async function auditSite(target) {
  console.log(`  🤖 AI Auditing: ${target.name}`);

  const prompt = buildAuditPrompt(target);

  for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
    try {
      const response = await runOpenCodeAudit(prompt);
      const auditResult = extractJSON(response);

      if (auditResult && auditResult.scores) {
        const fullResult = {
          ...target,
          scores: auditResult.scores,
          issues: auditResult.issues || {},
          recommendations: auditResult.recommendations || [],
          summary: auditResult.summary || '',
          aiAuditTimestamp: new Date().toISOString()
        };

        console.log(`  ✅ Done: ${target.name} - Score: ${fullResult.scores.overall}`);
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
  return null;
}

function saveAuditResult(result) {
  mkdirSync(AUDITS_DIR, { recursive: true });

  const existing = loadAuditRegistry();
  const prevFile = existing[result.url]?.filename;

  if (prevFile) {
    const prevPath = join(AUDITS_DIR, prevFile);
    if (existsSync(prevPath)) {
      const oldContent = readFileSync(prevPath, 'utf-8');
      const oldScores = oldContent.match(/overall = (\d+)/);
      if (oldScores && parseInt(oldScores[1]) === (result.scores?.overall || 0)) {
        console.log(`  🔄 Score unchanged (${result.scores?.overall}), rewriting timestamp`);
        existing[result.url] = { ...existing[result.url], lastAuditedAt: new Date().toISOString() };
        saveAuditRegistry(existing);
        return;
      }
    }
  }

  const escapeToml = (str) => (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

  const hash = result.hash || '';
  const filename = `${result.type || 'unknown'}-${(result.name || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${hash.slice(0, 8) || 'no-hash'}.toml`;
  const filepath = join(AUDITS_DIR, filename);

  const recommendations = (result.recommendations || []).map(r => `"${escapeToml(r)}"`).join(',\n  ');
  const issuesByCat = (obj) => Object.entries(obj || {}).map(([cat, issues]) =>
    `[issues.${cat}]\n` + (issues || []).map(i => `"${escapeToml(i)}"`).join('\n')
  ).join('\n\n');

  const tomlContent = `[audit]
url = "${escapeToml(result.url)}"
name = "${escapeToml(result.name)}"
type = "${escapeToml(result.type)}"
region = "${escapeToml(result.region)}"
category = "${escapeToml(result.category)}"
timestamp = "${result.scrapedAt || result.aiAuditTimestamp || new Date().toISOString()}"
hash = "${hash}"

[scores]
accessibility = ${result.scores?.accessibility || 0}
seo = ${result.scores?.seo || 0}
performance = ${result.scores?.performance || 0}
security = ${result.scores?.security || 0}
overall = ${result.scores?.overall || 0}

[summary]
text = "${escapeToml(result.summary)}"

[recommendations]
items = [
  ${recommendations || '"No recommendations"'}
]

${issuesByCat(result.issues)}
`;
  writeFileSync(filepath, tomlContent);

  const existing2 = loadAuditRegistry();
  existing2[result.url] = {
    url: result.url,
    name: result.name,
    filename,
    hash,
    scores: result.scores,
    lastAuditedAt: new Date().toISOString(),
    auditCount: (existing2[result.url]?.auditCount || 0) + 1,
    scoreHistory: [...(existing2[result.url]?.scoreHistory || []), { score: result.scores?.overall, at: new Date().toISOString() }]
  };
  saveAuditRegistry(existing2);

  console.log(`  💾 Saved: ${filename}`);
}

async function main() {
  const args = process.argv.slice(2);
  const allFlag = args.includes('--all');

  console.log('🤖 Audit-Auto AI Auditor');
  console.log('========================\n');

  if (!existsSync(SCRAPE_RESULTS_PATH)) {
    console.log('❌ No scraped data found. Run full-scraper.mjs --audit first.');
    process.exit(1);
  }

  const scrapeData = JSON.parse(readFileSync(SCRAPE_RESULTS_PATH, 'utf-8'));
  const scrapedTargets = scrapeData.results || [];
  const scrapeHistory = loadScrapeHistory();
  const auditRegistry = loadAuditRegistry();

  if (scrapedTargets.length === 0) {
    console.log('❌ No targets found in scrape results.');
    process.exit(1);
  }

  const toAudit = scrapedTargets.filter(t => {
    const prevAudit = auditRegistry[t.url];
    const currentHash = scrapeHistory[t.url]?.hash || t.hash;
    if (!prevAudit) return true;
    if (prevAudit.hash !== currentHash) return true;
    return false;
  });

  const skipCount = scrapedTargets.length - toAudit.length;

  console.log(`📊 Total scraped: ${scrapedTargets.length}`);
  console.log(`🤖 New/changed to audit: ${toAudit.length}`);
  console.log(`⏭️  Skipped (unchanged): ${skipCount}\n`);

  if (toAudit.length === 0) {
    console.log('✅ All targets unchanged since last audit. Nothing to do.');
    return;
  }

  const results = [];

  for (const target of toAudit) {
    const result = await auditSite(target);
    if (result) {
      result.hash = scrapeHistory[target.url]?.hash || target.hash;
      results.push(result);
      saveAuditResult(result);
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    totalTargets: scrapedTargets.length,
    newAudits: results.length,
    skippedUnchanged: skipCount,
    averageScores: {
      accessibility: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.accessibility || 0), 0) / results.length) : 0,
      seo: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.seo || 0), 0) / results.length) : 0,
      performance: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.performance || 0), 0) / results.length) : 0,
      security: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.security || 0), 0) / results.length) : 0,
      overall: results.length ? Math.round(results.reduce((a, r) => a + (r.scores?.overall || 0), 0) / results.length) : 0
    },
    registry: {
      totalUniqueSites: Object.keys(loadAuditRegistry()).length,
      totalAuditFiles: existsSync(AUDITS_DIR) ? readFileSync(AUDITS_DIR).toString() : 0
    }
  };

  const summaryPath = join(ROOT_DIR, 'data', 'latest-audit-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\n========================');
  console.log('✅ AI Audit cycle complete!');
  console.log(`📊 New audits: ${results.length}/${toAudit.length}`);
  console.log(`⏭️  Skipped unchanged: ${skipCount}`);
  console.log(`📈 Average Overall Score: ${summary.averageScores.overall}`);
  console.log(`📝 Registry: ${summary.registry.totalUniqueSites} unique sites`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
