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

// Track execution time
const startTime = Date.now();

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
  } catch (error) {
    console.error('⚠️  Discovery failed, continuing...');
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
  } catch (error) {
    console.error('⚠️  Scraping failed, continuing...');
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
  } catch (error) {
    console.error('⚠️  AI Auditing failed, continuing...');
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
} catch (error) {
  console.error('⚠️  Dashboard generation failed');
}

// Step 5: Save Pipeline Stats
const endTime = Date.now();
const duration = Math.round((endTime - startTime) / 1000);

const stats = {
  startedAt: new Date(startTime).toISOString(),
  completedAt: new Date().toISOString(),
  durationSeconds: duration,
  durationFormatted: `${Math.floor(duration / 60)}m ${duration % 60}s`,
  mode: allFlag ? 'full' : discoverFlag ? 'discover' : scrapeFlag ? 'scrape' : auditFlag ? 'audit' : 'default'
};

const statsPath = join(ROOT_DIR, 'data', 'pipeline-stats.json');
writeFileSync(statsPath, JSON.stringify(stats, null, 2));

console.log('\n=====================');
console.log('✅ Pipeline Complete!');
console.log(`⏱️  Duration: ${stats.durationFormatted}`);
console.log(`📊 Stats saved to: data/pipeline-stats.json`);
