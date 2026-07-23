#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const args = process.argv.slice(2);
const discoverFlag = args.includes('--discover');
const scrapeFlag = args.includes('--scrape');
const auditFlag = args.includes('--audit');
const allFlag = args.includes('--all');

console.log('🚀 Audit-Auto Dynamic Pipeline');
console.log('===============================\n');
console.log(`⏰ Started at: ${new Date().toISOString()}`);
console.log(`📋 Mode: ${allFlag ? 'FULL' : discoverFlag ? 'DISCOVER' : scrapeFlag ? 'SCRAPE' : auditFlag ? 'AUDIT' : 'DEFAULT'}`);

const startTime = Date.now();
const stepResults = [];

function runStep(name, command) {
  console.log(`\n📍 ${name}`);
  console.log('-'.repeat(name.length + 4));
  try {
    execSync(command, { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`\n✅ ${name} complete`);
    stepResults.push({ step: name.toLowerCase().replace(/\s+/g, '_'), success: true });
    return true;
  } catch (error) {
    console.error(`\n⚠️  ${name} failed: ${error.message}`);
    stepResults.push({ step: name.toLowerCase().replace(/\s+/g, '_'), success: false, error: error.message });
    return false;
  }
}

function mergeStaticIntoDiscovery() {
  console.log('\n📋 Merging static TOML targets into known-targets.json...');
  const knownPath = join(ROOT_DIR, 'data', 'known-targets.json');

  let known = [];
  if (existsSync(knownPath)) {
    known = JSON.parse(readFileSync(knownPath, 'utf-8'));
  }

  const seen = new Set(known.map(t => t.url));
  const staticDirs = [
    { file: 'data/targets-us.toml', region: 'us' },
    { file: 'data/targets-eu.toml', region: 'eu' },
    { file: 'data/targets-ngos.toml', region: 'ngos' }
  ];

  let merged = 0;
  for (const { file, region } of staticDirs) {
    const filePath = join(ROOT_DIR, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const matches = content.matchAll(/\[\[targets\]\][\s\S]*?(?=\[\[targets\]\]|$)/g);
      for (const match of matches) {
        const block = match[0];
        const name = block.match(/name\s*=\s*"([^"]+)"/)?.[1];
        const url = block.match(/url\s*=\s*"([^"]+)"/)?.[1];
        const type = block.match(/type\s*=\s*"([^"]+)"/)?.[1] || (region === 'ngos' ? 'ngo' : 'enterprise');
        if (name && url && !seen.has(url)) {
          known.push({
            name, url, type,
            region: region === 'ngos' ? 'international' : region,
            category: block.match(/category\s*=\s*"([^"]+)"/)?.[1] || 'general',
            discoveredAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            discoveredBy: 'static:toml'
          });
          seen.add(url);
          merged++;
        }
      }
    }
  }

  if (merged > 0) {
    mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
    writeFileSync(knownPath, JSON.stringify(known, null, 2));
    console.log(`  ✅ Merged ${merged} static targets into master list (total: ${known.length})`);
  } else {
    console.log(`  ℹ️  No new static targets to merge (total: ${known.length})`);
  }
}

function countAuditRegistry() {
  const regPath = join(ROOT_DIR, 'data', 'audit-registry.json');
  if (existsSync(regPath)) {
    const reg = JSON.parse(readFileSync(regPath, 'utf-8'));
    return Object.keys(reg).length;
  }
  return 0;
}

function countScrapeHistory() {
  const histPath = join(ROOT_DIR, 'data', 'scrape-history.json');
  if (existsSync(histPath)) {
    const hist = JSON.parse(readFileSync(histPath, 'utf-8'));
    return Object.keys(hist).length;
  }
  return 0;
}

if (allFlag) {
  runStep('Step 1: Dynamic Discovery', 'node scripts/discover-targets.mjs');

  mergeStaticIntoDiscovery();

  runStep('Step 2: Web Scraping', 'node scripts/full-scraper.mjs --audit');

  runStep('Step 3: AI Auditing', 'node scripts/ai-auditor.mjs --all');

  runStep('Step 4: Dashboard Data', 'node scripts/generate-dashboard-data.mjs');
} else {
  if (discoverFlag) {
    runStep('Discovery', 'node scripts/discover-targets.mjs');
    mergeStaticIntoDiscovery();
  }
  if (scrapeFlag) {
    runStep('Web Scraping', 'node scripts/full-scraper.mjs --audit');
  }
  if (auditFlag) {
    runStep('AI Auditing', 'node scripts/ai-auditor.mjs --all');
  }

  runStep('Dashboard Data', 'node scripts/generate-dashboard-data.mjs');
}

const endTime = Date.now();
const duration = Math.round((endTime - startTime) / 1000);
const hasFailures = stepResults.some(s => !s.success);

const stats = {
  startedAt: new Date(startTime).toISOString(),
  completedAt: new Date().toISOString(),
  durationSeconds: duration,
  durationFormatted: `${Math.floor(duration / 60)}m ${duration % 60}s`,
  mode: allFlag ? 'full' : discoverFlag ? 'discover' : scrapeFlag ? 'scrape' : auditFlag ? 'audit' : 'default',
  steps: stepResults,
  success: !hasFailures,
  registry: {
    uniqueSitesTracked: countScrapeHistory(),
    uniqueSitesAudited: countAuditRegistry(),
    totalAuditFiles: existsSync(join(ROOT_DIR, 'audits'))
      ? readdirSync(join(ROOT_DIR, 'audits')).filter(f => f.endsWith('.toml')).length
      : 0
  }
};

const statsPath = join(ROOT_DIR, 'data', 'pipeline-stats.json');
mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
writeFileSync(statsPath, JSON.stringify(stats, null, 2));

console.log('\n=====================');
if (hasFailures) {
  console.log('⚠️  Pipeline completed with failures');
  stepResults.filter(s => !s.success).forEach(s => {
    console.log(`  ❌ ${s.step}: ${s.error}`);
  });
} else {
  console.log('✅ Pipeline Complete!');
}
console.log(`⏱️  Duration: ${stats.durationFormatted}`);
console.log(`📊 Registry: ${stats.registry.uniqueSitesTracked} tracked, ${stats.registry.uniqueSitesAudited} audited`);
console.log(`📁 Audit files: ${stats.registry.totalAuditFiles}`);

if (hasFailures && (stepResults.find(s => s.step === 'scraping' && !s.success) || stepResults.find(s => s.step === 'auditing' && !s.success))) {
  process.exit(1);
}
