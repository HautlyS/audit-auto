#!/usr/bin/env node

/**
 * Generate Dashboard Data
 * Aggregates audit results into dashboard-friendly format
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import toml from 'toml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

function loadAllAudits() {
  const auditsDir = join(ROOT_DIR, 'audits');
  if (!existsSync(auditsDir)) return [];
  
  const files = readdirSync(auditsDir).filter(f => f.endsWith('.toml'));
  const audits = [];
  
  for (const file of files) {
    try {
      const content = readFileSync(join(auditsDir, file), 'utf-8');
      const data = toml.parse(content);
      audits.push(data.audit || data);
    } catch (e) {
      console.error(`Error parsing ${file}:`, e.message);
    }
  }
  
  return audits;
}

function generateDashboardData(audits) {
  // Group by type
  const byType = {
    enterprise: audits.filter(a => a.type === 'enterprise'),
    ngo: audits.filter(a => a.type === 'ngo')
  };
  
  // Group by region
  const byRegion = {
    us: audits.filter(a => a.region === 'us'),
    eu: audits.filter(a => a.region === 'eu'),
    international: audits.filter(a => a.region === 'international')
  };
  
  // Calculate averages
  const avgScores = {
    accessibility: 0,
    seo: 0,
    performance: 0,
    security: 0,
    overall: 0
  };
  
  if (audits.length > 0) {
    const totals = audits.reduce((acc, a) => ({
      accessibility: acc.accessibility + (a.scores?.accessibility || 0),
      seo: acc.seo + (a.scores?.seo || 0),
      performance: acc.performance + (a.scores?.performance || 0),
      security: acc.security + (a.scores?.security || 0),
      overall: acc.overall + (a.scores?.overall || 0)
    }), { accessibility: 0, seo: 0, performance: 0, security: 0, overall: 0 });
    
    Object.keys(avgScores).forEach(key => {
      avgScores[key] = Math.round(totals[key] / audits.length);
    });
  }
  
  // Top issues
  const allIssues = audits.flatMap(a => [
    ...(a.issues?.accessibility || []),
    ...(a.issues?.seo || []),
    ...(a.issues?.performance || []),
    ...(a.issues?.security || [])
  ]);
  
  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const highIssues = allIssues.filter(i => i.severity === 'high');
  
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalAudits: audits.length,
      averageScores: avgScores,
      criticalIssues: criticalIssues.length,
      highIssues: highIssues.length
    },
    byType,
    byRegion,
    recentAudits: audits.slice(-20),
    allAudits: audits
  };
}

// Main
const audits = loadAllAudits();
const dashboardData = generateDashboardData(audits);

writeFileSync(
  join(ROOT_DIR, 'data', 'dashboard-data.json'),
  JSON.stringify(dashboardData, null, 2)
);

console.log('✅ Dashboard data generated');
console.log(`📊 Total audits: ${dashboardData.summary.totalAudits}`);
console.log(`📈 Average overall score: ${dashboardData.summary.averageScores.overall}`);
