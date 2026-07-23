#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import toml from 'toml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

function loadAuditRegistry() {
  const regPath = join(ROOT_DIR, 'data', 'audit-registry.json');
  if (existsSync(regPath)) {
    return JSON.parse(readFileSync(regPath, 'utf-8'));
  }
  return {};
}

function loadAllAuditFiles() {
  const auditsDir = join(ROOT_DIR, 'audits');
  if (!existsSync(auditsDir)) return [];

  const files = readdirSync(auditsDir).filter(f => f.endsWith('.toml'));
  const audits = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(auditsDir, file), 'utf-8');
      const data = toml.parse(content);
      const audit = data.audit || data;
      audits.push(audit);
    } catch (e) {
      console.error(`Error parsing ${file}:`, e.message);
    }
  }

  return audits;
}

function loadKnownTargets() {
  const knownPath = join(ROOT_DIR, 'data', 'known-targets.json');
  if (existsSync(knownPath)) {
    return JSON.parse(readFileSync(knownPath, 'utf-8'));
  }
  return [];
}

function generateDashboardData() {
  const registry = loadAuditRegistry();
  const audits = loadAllAuditFiles();
  const targets = loadKnownTargets();

  const byUrl = {};
  for (const audit of audits) {
    if (audit.url) {
      if (!byUrl[audit.url] || new Date(audit.timestamp || 0) > new Date(byUrl[audit.url].timestamp || 0)) {
        byUrl[audit.url] = audit;
      }
    }
  }

  const latestAudits = Object.values(byUrl);

  const byType = {
    enterprise: latestAudits.filter(a => a.type === 'enterprise'),
    ngo: latestAudits.filter(a => a.type === 'ngo')
  };

  const byRegion = {
    us: latestAudits.filter(a => a.region === 'us'),
    eu: latestAudits.filter(a => a.region === 'eu'),
    international: latestAudits.filter(a => a.region === 'international')
  };

  const avgScores = { accessibility: 0, seo: 0, performance: 0, security: 0, overall: 0 };
  if (latestAudits.length > 0) {
    const totals = latestAudits.reduce((acc, a) => ({
      accessibility: acc.accessibility + (a.scores?.accessibility || 0),
      seo: acc.seo + (a.scores?.seo || 0),
      performance: acc.performance + (a.scores?.performance || 0),
      security: acc.security + (a.scores?.security || 0),
      overall: acc.overall + (a.scores?.overall || 0)
    }), { accessibility: 0, seo: 0, performance: 0, security: 0, overall: 0 });

    Object.keys(avgScores).forEach(key => {
      avgScores[key] = Math.round(totals[key] / latestAudits.length);
    });
  }

  const scoreTrends = [];
  for (const [url, info] of Object.entries(registry)) {
    if (info.scoreHistory && info.scoreHistory.length > 1) {
      const history = info.scoreHistory;
      const direction = history[history.length - 1].score > history[0].score ? 'up' :
                        history[history.length - 1].score < history[0].score ? 'down' : 'stable';
      scoreTrends.push({
        url,
        name: info.name,
        direction,
        change: history[history.length - 1].score - history[0].score,
        firstScore: history[0].score,
        currentScore: history[history.length - 1].score,
        auditCount: info.auditCount || history.length,
        history
      });
    }
  }
  scoreTrends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const totalIssues = latestAudits.reduce((acc, a) => {
    const issues = a.issues || {};
    let count = 0;
    for (const cat of Object.values(issues)) {
      if (Array.isArray(cat)) count += cat.length;
    }
    return acc + count;
  }, 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalAudits: latestAudits.length,
      totalTargetsInRegistry: Object.keys(registry).length,
      totalKnownTargets: targets.length,
      averageScores: avgScores,
      totalIssues,
      uniqueSitesWithHistory: scoreTrends.length
    },
    byType,
    byRegion,
    recentAudits: latestAudits.slice(-20).reverse(),
    allAudits: latestAudits,
    scoreTrends: scoreTrends.slice(0, 10),
    registry: Object.fromEntries(
      Object.entries(registry).map(([url, info]) => [url, {
        name: info.name,
        scores: info.scores,
        lastAuditedAt: info.lastAuditedAt,
        auditCount: info.auditCount
      }])
    )
  };
}

const dashboardData = generateDashboardData();

writeFileSync(
  join(ROOT_DIR, 'data', 'dashboard-data.json'),
  JSON.stringify(dashboardData, null, 2)
);

console.log('✅ Dashboard data generated');
console.log(`📊 Latest unique audits: ${dashboardData.summary.totalAudits}`);
console.log(`📝 Registry: ${dashboardData.summary.totalTargetsInRegistry} unique sites`);
console.log(`📈 Average score: ${dashboardData.summary.averageScores.overall}`);
console.log(`📉 Sites with score trends: ${dashboardData.summary.uniqueSitesWithHistory}`);
