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
  maxConcurrent: 3,
  timeout: 20000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

const KNOWN_TARGETS_PATH = join(ROOT_DIR, 'data', 'known-targets.json');
const SCRAPE_RESULTS_PATH = join(ROOT_DIR, 'data', 'latest-scrape-results.json');
const HISTORY_PATH = join(ROOT_DIR, 'data', 'scrape-history.json');

const SEED_TARGETS = [
  { name: 'Apple', url: 'https://www.apple.com', category: 'technology', region: 'us', type: 'enterprise' },
  { name: 'Microsoft', url: 'https://www.microsoft.com', category: 'technology', region: 'us', type: 'enterprise' },
  { name: 'Google', url: 'https://about.google', category: 'technology', region: 'us', type: 'enterprise' },
  { name: 'Amazon', url: 'https://www.amazon.com', category: 'technology', region: 'us', type: 'enterprise' },
  { name: 'Tesla', url: 'https://www.tesla.com', category: 'automotive', region: 'us', type: 'enterprise' },
  { name: 'Meta', url: 'https://about.meta.com', category: 'technology', region: 'us', type: 'enterprise' },
  { name: 'Netflix', url: 'https://www.netflix.com', category: 'entertainment', region: 'us', type: 'enterprise' },
  { name: 'Adobe', url: 'https://www.adobe.com', category: 'technology', region: 'us', type: 'enterprise' },
  { name: 'Salesforce', url: 'https://www.salesforce.com', category: 'technology', region: 'us', type: 'enterprise' },
  { name: 'Intel', url: 'https://www.intel.com', category: 'technology', region: 'us', type: 'enterprise' },
  { name: 'SAP', url: 'https://www.sap.com', category: 'technology', region: 'eu', type: 'enterprise' },
  { name: 'Siemens', url: 'https://www.siemens.com', category: 'industrial', region: 'eu', type: 'enterprise' },
  { name: 'BMW', url: 'https://www.bmw.com', category: 'automotive', region: 'eu', type: 'enterprise' },
  { name: 'Nestle', url: 'https://www.nestle.com', category: 'food', region: 'eu', type: 'enterprise' },
  { name: 'HSBC', url: 'https://www.hsbc.com', category: 'finance', region: 'eu', type: 'enterprise' },
  { name: 'Earth Guardians', url: 'https://www.earthguardians.org', category: 'environment', region: 'us', type: 'ngo' },
  { name: 'Greenpeace', url: 'https://www.greenpeace.org', category: 'environment', region: 'international', type: 'ngo' },
  { name: 'WWF', url: 'https://www.worldwildlife.org', category: 'environment', region: 'international', type: 'ngo' },
  { name: 'Red Cross', url: 'https://www.redcross.org', category: 'humanitarian', region: 'us', type: 'ngo' },
  { name: 'Amnesty International', url: 'https://www.amnesty.org', category: 'human_rights', region: 'international', type: 'ngo' }
];

function loadTargets() {
  if (existsSync(KNOWN_TARGETS_PATH)) {
    const known = JSON.parse(readFileSync(KNOWN_TARGETS_PATH, 'utf-8'));
    if (known.length > 0) return known;
  }
  const withTimestamps = SEED_TARGETS.map(t => ({
    ...t, discoveredAt: new Date(0).toISOString(), lastSeenAt: new Date().toISOString()
  }));
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
  writeFileSync(KNOWN_TARGETS_PATH, JSON.stringify(withTimestamps, null, 2));
  return withTimestamps;
}

function loadScrapeHistory() {
  if (existsSync(HISTORY_PATH)) {
    return JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'));
  }
  return {};
}

function saveScrapeHistory(history) {
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function contentHash(data) {
  const str = JSON.stringify({
    title: data.title,
    description: data.seo,
    accessibility: data.accessibility,
    performance: data.performance,
    security: { isHttps: data.security.isHttps },
    content: data.content
  });
  return createHash('md5').update(str).digest('hex');
}

async function scrapeSite(page, target) {
  try {
    console.log(`  🔎 Scraping: ${target.name} (${target.url})`);

    await page.goto(target.url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.timeout
    });
    await page.waitForTimeout(1500);

    const html = await page.content();
    const $ = cheerio.load(html);

    const data = {
      url: target.url,
      name: target.name,
      type: target.type,
      region: target.region,
      category: target.category,
      title: $('title').text().trim() || 'No title',
      description: $('meta[name="description"]').attr('content') || '',

      seo: {
        title: $('title').text().trim(),
        metaDescription: $('meta[name="description"]').attr('content') || '',
        h1Count: $('h1').length,
        h2Count: $('h2').length,
        images: $('img').length,
        imagesWithoutAlt: $('img:not([alt])').length,
        links: $('a').length,
        canonical: $('link[rel="canonical"]').attr('href') || '',
        ogTitle: $('meta[property="og:title"]').attr('content') || '',
        schemaOrg: $('script[type="application/ld+json"]').length > 0
      },

      accessibility: {
        hasLangAttr: $('html').attr('lang') !== undefined,
        formLabels: $('label').length,
        ariaLandmarks: $('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]').length
      },

      performance: {
        scripts: $('script').length,
        stylesheets: $('link[rel="stylesheet"]').length,
        iframes: $('iframe').length
      },

      security: {
        isHttps: target.url.startsWith('https://'),
        mixedContent: $('script[src^="http:"], link[href^="http:"]').length
      },

      content: {
        wordCount: $('body').text().split(/\s+/).filter(w => w.length > 0).length,
        headings: $('h1, h2, h3, h4, h5, h6').length
      },

      scrapedAt: new Date().toISOString()
    };

    data.hash = contentHash(data);

    let accessibility = 100, seo = 100, performance = 100, security = 100;

    if (!data.accessibility.hasLangAttr) accessibility -= 10;
    if (data.seo.imagesWithoutAlt > 0) accessibility -= Math.min(30, data.seo.imagesWithoutAlt * 5);
    if (data.accessibility.ariaLandmarks === 0) accessibility -= 20;

    if (!data.seo.title) seo -= 20;
    if (!data.seo.metaDescription) seo -= 15;
    if (data.seo.h1Count === 0) seo -= 15;
    if (!data.seo.canonical) seo -= 10;
    if (!data.seo.schemaOrg) seo -= 5;

    if (data.performance.scripts > 20) performance -= 20;
    if (data.performance.stylesheets > 10) performance -= 15;

    if (!data.security.isHttps) security -= 50;
    if (data.security.mixedContent > 0) security -= 20;

    data.scores = {
      accessibility: Math.max(0, Math.min(100, accessibility)),
      seo: Math.max(0, Math.min(100, seo)),
      performance: Math.max(0, Math.min(100, performance)),
      security: Math.max(0, Math.min(100, security)),
      overall: Math.max(0, Math.min(100, Math.round((accessibility + seo + performance + security) / 4)))
    };

    const changed = data.hash !== (loadScrapeHistory()[target.url]?.hash || '');
    if (changed) {
      console.log(`  ✅ Changed: ${target.name} - Score: ${data.scores.overall} (hash: ${data.hash.slice(0, 8)})`);
    } else {
      console.log(`  🔄 Unchanged: ${target.name} - Score: ${data.scores.overall}`);
    }

    return data;

  } catch (error) {
    console.log(`  ❌ Error: ${target.name} - ${error.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const auditFlag = args.includes('--audit') || args.includes('--all');

  console.log('🌐 Audit-Auto Smart Scraper');
  console.log('============================\n');

  const allTargets = loadTargets();
  console.log(`🎯 Targets in master list: ${allTargets.length}`);

  if (!auditFlag) {
    console.log('\nℹ️  Use --audit or --all to start scraping');
    return;
  }

  const newTargets = allTargets.filter(t => {
    const d = new Date(t.discoveredAt);
    const history = loadScrapeHistory();
    return !history[t.url] || (Date.now() - d.getTime()) < 3600000;
  });

  const existingTargets = allTargets.filter(t => !newTargets.includes(t));

  console.log(`🆕 New/priority targets: ${newTargets.length}`);
  console.log(`🔄 Existing targets: ${existingTargets.length}`);

  const orderedTargets = [...newTargets, ...existingTargets];

  if (orderedTargets.length === 0) {
    console.log('\n❌ No targets to scrape');
    return;
  }

  console.log('\n🚀 Starting scrape...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const results = [];
  const history = loadScrapeHistory();

  try {
    for (const target of orderedTargets) {
      const context = await browser.newContext({ userAgent: CONFIG.userAgent });
      const page = await context.newPage();

      try {
        const result = await scrapeSite(page, target);
        if (result) {
          results.push(result);
          history[target.url] = {
            hash: result.hash,
            scores: result.scores,
            scrapedAt: result.scrapedAt,
            name: target.name
          };
        }
      } finally {
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  saveScrapeHistory(history);

  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });

  const changedCount = results.filter(r => history[r.url]?.hash === r.hash).length;

  writeFileSync(SCRAPE_RESULTS_PATH, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalScraped: results.length,
    totalTargets: orderedTargets.length,
    changedCount,
    results
  }, null, 2));

  console.log('\n===============================');
  console.log(`✅ Scrape complete!`);
  console.log(`📊 Results: ${results.length}/${orderedTargets.length} sites scraped (${changedCount} changed)`);
  console.log(`💾 Saved to: data/latest-scrape-results.json`);
  console.log(`📝 History: ${Object.keys(history).length} unique sites tracked`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
