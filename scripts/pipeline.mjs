#!/usr/bin/env node

/**
 * Pipeline - Orchestrates full scraping and AI auditing
 * Main entry point for the audit system
 * 
 * Usage: node scripts/pipeline.mjs [--discover] [--scrape] [--audit] [--all]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Parse arguments
const args = process.argv.slice(2);
const discoverFlag = args.includes('--discover');
const scrapeFlag = args.includes('--scrape');
const auditFlag = args.includes('--audit');
const allFlag = args.includes('--all');

console.log('🚀 Audit-Auto Pipeline');
console.log('=====================\n');
console.log(`⏰ Started at: ${new Date().toISOString()}`);
console.log(`📋 Mode: ${allFlag ? 'FULL' : discoverFlag ? 'DISCOVER' : scrapeFlag ? 'SCRAPE' : auditFlag ? 'AUDIT' : 'DEFAULT'}`);

// Track execution time and step results
const startTime = Date.now();
const stepResults: { step: string; success: boolean; error?: string }[] = [];

// Step 1: Discovery (optional)
if (discoverFlag || allFlag) {
  console.log('\n📍 Step 1: Target Discovery');
  console.log('---------------------------');
  
  try {
    execSync('node scripts/full-scraper.mjs --discover', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    console.log('✅ Discovery complete');
    stepResults.push({ step: 'discovery', success: true });
  } catch (error: any) {
    console.error('⚠️  Discovery failed:', error.message);
    stepResults.push({ step: 'discovery', success: false, error: error.message });
  }
}

// Step 2: Scraping
if (scrapeFlag || allFlag) {
  console.log('\n📍 Step 2: Web Scraping');
  console.log('-----------------------');
  
  try {
    execSync('node scripts/full-scraper.mjs --audit', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    console.log('✅ Scraping complete');
    stepResults.push({ step: 'scraping', success: true });
  } catch (error: any) {
    console.error('⚠️  Scraping failed:', error.message);
    stepResults.push({ step: 'scraping', success: false, error: error.message });
  }
}

// Step 3: AI Auditing
if (auditFlag || allFlag) {
  console.log('\n📍 Step 3: AI Auditing');
  console.log('----------------------');
  
  try {
    execSync('node scripts/ai-auditor.mjs --all', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    console.log('✅ AI Auditing complete');
    stepResults.push({ step: 'auditing', success: true });
  } catch (error: any) {
    console.error('⚠️  AI Auditing failed:', error.message);
    stepResults.push({ step: 'auditing', success: false, error: error.message });
  }
}

// Step 4: Generate Dashboard Data
console.log('\n📍 Step 4: Generating Dashboard Data');
console.log('------------------------------------');

try {
  execSync('node scripts/generate-dashboard-data.mjs', {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });
  console.log('✅ Dashboard data generated');
  stepResults.push({ step: 'dashboard', success: true });
} catch (error: any) {
  console.error('⚠️  Dashboard generation failed:', error.message);
  stepResults.push({ step: 'dashboard', success: false, error: error.message });
}

// Step 5: Save Pipeline Stats
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
  success: !hasFailures
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
console.log(`📊 Stats saved to: data/pipeline-stats.json`);

// Exit with error code if any critical step failed
if (hasFailures && (stepResults.find(s => s.step === 'scraping' && !s.success) || stepResults.find(s => s.step === 'auditing' && !s.success))) {
  process.exit(1);
}
