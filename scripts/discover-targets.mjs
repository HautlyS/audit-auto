#!/usr/bin/env node

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const CONFIG = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  timeout: 15000
};

const KNOWN_TARGETS_PATH = join(ROOT_DIR, 'data', 'known-targets.json');
const STATIC_TARGET_DIRS = [
  { file: 'data/targets-us.toml', region: 'us' },
  { file: 'data/targets-eu.toml', region: 'eu' },
  { file: 'data/targets-ngos.toml', region: 'ngos' }
];

function loadKnownTargets() {
  if (existsSync(KNOWN_TARGETS_PATH)) {
    return JSON.parse(readFileSync(KNOWN_TARGETS_PATH, 'utf-8'));
  }
  return [];
}

function saveKnownTargets(targets) {
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
  writeFileSync(KNOWN_TARGETS_PATH, JSON.stringify(targets, null, 2));
}

function mergeTargets(existing, newTargets) {
  const seen = new Set(existing.map(t => t.url));
  let added = 0;
  for (const t of newTargets) {
    if (!seen.has(t.url)) {
      existing.push({ ...t, discoveredAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() });
      seen.add(t.url);
      added++;
    } else {
      const found = existing.find(e => e.url === t.url);
      if (found) found.lastSeenAt = new Date().toISOString();
    }
  }
  return added;
}

async function crawlWikipedia(browser) {
  const discovered = [];
  const wikiLists = [
    { url: 'https://en.wikipedia.org/wiki/List_of_largest_companies_by_revenue', type: 'enterprise', region: 'us' },
    { url: 'https://en.wikipedia.org/wiki/List_of_largest_companies_in_the_United_States_by_revenue', type: 'enterprise', region: 'us' },
    { url: 'https://en.wikipedia.org/wiki/List_of_largest_companies_in_Europe_by_revenue', type: 'enterprise', region: 'eu' },
    { url: 'https://en.wikipedia.org/wiki/List_of_largest_employers', type: 'enterprise', region: 'international' },
    { url: 'https://en.wikipedia.org/wiki/List_of_international_non-governmental_organizations', type: 'ngo', region: 'international' }
  ];

  for (const entry of wikiLists) {
    try {
      console.log(`  🌐 Crawling: ${entry.url}`);
      const context = await browser.newContext({ userAgent: CONFIG.userAgent });
      const page = await context.newPage();
      await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
      await page.waitForTimeout(1000);

      const links = await page.evaluate(() => {
        const results = [];
        const tables = document.querySelectorAll('table.wikitable, table.infobox');
        tables.forEach(table => {
          const rows = table.querySelectorAll('tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length >= 2) {
              const anchor = cells[0].querySelector('a');
              if (anchor && anchor.href && anchor.textContent.trim()) {
                results.push({ name: anchor.textContent.trim(), wikiUrl: anchor.href });
              }
            }
          });
        });
        return results.slice(0, 30);
      });

      for (const l of links) {
        if (l.name.length > 2 && !l.name.includes('[')) {
          discovered.push({
            name: l.name,
            url: `https://${l.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
            type: entry.type,
            region: entry.region,
            category: 'general',
            discoveredBy: `wikipedia:${entry.url.split('/').pop()}`
          });
        }
      }
      await context.close();
    } catch (e) {
      console.log(`  ⚠️  Wikipedia crawl failed for ${entry.url}: ${e.message.slice(0, 80)}`);
    }
  }
  return discovered;
}

async function crawlExistingSites(browser, knownTargets) {
  const discovered = [];
  const samples = knownTargets.filter(t => t.type === 'ngo' || t.type === 'enterprise').slice(0, 5);

  for (const target of samples) {
    try {
      console.log(`  🔗 Following links from: ${target.name}`);
      const context = await browser.newContext({ userAgent: CONFIG.userAgent });
      const page = await context.newPage();
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
      await page.waitForTimeout(1000);

      const externalLinks = await page.evaluate(() => {
        const results = [];
        const anchors = document.querySelectorAll('a[href^="http"]');
        const seen = new Set();
        anchors.forEach(a => {
          try {
            const url = new URL(a.href);
            if (url.hostname !== location.hostname && !seen.has(url.hostname)) {
              seen.add(url.hostname);
              results.push({ name: a.textContent.trim().slice(0, 60) || url.hostname, url: url.origin });
            }
          } catch {}
        });
        return results.slice(0, 10);
      });

      for (const l of externalLinks) {
        if (l.name.length > 2) {
          discovered.push({
            name: l.name,
            url: l.url,
            type: 'enterprise',
            region: 'international',
            category: 'general',
            discoveredBy: `crosslink:${target.name}`
          });
        }
      }
      await context.close();
    } catch (e) {
      console.log(`  ⚠️  Cross-link crawl failed for ${target.name}: ${e.message.slice(0, 80)}`);
    }
  }
  return discovered;
}

async function main() {
  console.log('🔍 Audit-Auto Target Discovery');
  console.log('==============================\n');

  const knownTargets = loadKnownTargets();
  console.log(`📂 Known targets: ${knownTargets.length}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let totalNew = 0;

  try {
    const wikiTargets = await crawlWikipedia(browser);
    const added = mergeTargets(knownTargets, wikiTargets);
    console.log(`  📝 Wikipedia: ${wikiTargets.length} candidates, ${added} new`);
    totalNew += added;

    const crosslinkTargets = await crawlExistingSites(browser, knownTargets);
    const added2 = mergeTargets(knownTargets, crosslinkTargets);
    console.log(`  🔗 Cross-links: ${crosslinkTargets.length} candidates, ${added2} new`);
    totalNew += added2;

  } finally {
    await browser.close();
  }

  saveKnownTargets(knownTargets);

  console.log(`\n✅ Discovery complete`);
  console.log(`📊 Total known targets: ${knownTargets.length}`);
  console.log(`🆕 New targets found: ${totalNew}`);

  if (totalNew > 0) {
    const newOnes = knownTargets.filter(t => {
      const d = new Date(t.discoveredAt);
      return (Date.now() - d.getTime()) < 60000;
    });
    newOnes.forEach(t => console.log(`  🆕 ${t.name} (${t.url}) [${t.type}/${t.region}]`));
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
