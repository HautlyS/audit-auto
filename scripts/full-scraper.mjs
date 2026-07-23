#!/usr/bin/env node

/**
 * Full Scraper - Playwright-based web scraper for target discovery & auditing
 * Scrapes Reddit, forums, company sites, NGOs for comprehensive data collection
 * 
 * Usage: node scripts/full-scraper.mjs [--discover] [--audit] [--all]
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Configuration
const CONFIG = {
  maxConcurrent: 3,
  timeout: 20000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

// Predefined high-value targets
const ALL_TARGETS = [
  // US Enterprises
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
  // EU Enterprises
  { name: 'SAP', url: 'https://www.sap.com', category: 'technology', region: 'eu', type: 'enterprise' },
  { name: 'Siemens', url: 'https://www.siemens.com', category: 'industrial', region: 'eu', type: 'enterprise' },
  { name: 'BMW', url: 'https://www.bmw.com', category: 'automotive', region: 'eu', type: 'enterprise' },
  { name: 'Nestle', url: 'https://www.nestle.com', category: 'food', region: 'eu', type: 'enterprise' },
  { name: 'HSBC', url: 'https://www.hsbc.com', category: 'finance', region: 'eu', type: 'enterprise' },
  // NGOs
  { name: 'Earth Guardians', url: 'https://www.earthguardians.org', category: 'environment', region: 'us', type: 'ngo' },
  { name: 'Greenpeace', url: 'https://www.greenpeace.org', category: 'environment', region: 'international', type: 'ngo' },
  { name: 'WWF', url: 'https://www.worldwildlife.org', category: 'environment', region: 'international', type: 'ngo' },
  { name: 'Red Cross', url: 'https://www.redcross.org', category: 'humanitarian', region: 'us', type: 'ngo' },
  { name: 'Amnesty International', url: 'https://www.amnesty.org', category: 'human_rights', region: 'international', type: 'ngo' }
];

// Scrape a single site
async function scrapeSite(target) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ userAgent: CONFIG.userAgent });
  const page = await context.newPage();
  
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
    
    // Calculate scores
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
    
    console.log(`  ✅ Done: ${target.name} - Score: ${data.scores.overall}`);
    return data;
    
  } catch (error) {
    console.log(`  ❌ Error: ${target.name} - ${error.message}`);
    return null;
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const auditFlag = args.includes('--audit') || args.includes('--all');
  
  console.log('🌐 Autit-Auto Full Scraper');
  console.log('==========================\n');
  console.log(`🎯 Targets: ${ALL_TARGETS.length}`);
  
  if (!auditFlag) {
    console.log('\nℹ️  Use --audit or --all to start scraping');
    return;
  }
  
  console.log('\n🚀 Starting scrape...\n');
  
  const limit = pLimit(CONFIG.maxConcurrent);
  const results = [];
  
  const promises = ALL_TARGETS.map(target => 
    limit(async () => {
      const result = await scrapeSite(target);
      if (result) results.push(result);
    })
  );
  
  await Promise.all(promises);
  
  // Save results
  const outputDir = join(ROOT_DIR, 'data');
  mkdirSync(outputDir, { recursive: true });
  
  const outputPath = join(outputDir, 'latest-scrape-results.json');
  writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalScraped: results.length,
    results
  }, null, 2));
  
  console.log('\n===========================');
  console.log(`✅ Scrape complete!`);
  console.log(`📊 Results: ${results.length}/${ALL_TARGETS.length} sites scraped`);
  console.log(`💾 Saved to: data/latest-scrape-results.json`);
}

main().catch(console.error);
