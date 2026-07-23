#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const KNOWN_TARGETS_PATH = join(ROOT_DIR, 'data', 'known-targets.json');

const STATIC_DIRS = [
  { file: 'data/targets-us.toml', region: 'us' },
  { file: 'data/targets-eu.toml', region: 'eu' },
  { file: 'data/targets-ngos.toml', region: 'ngos' }
];

function main() {
  let known = [];
  if (existsSync(KNOWN_TARGETS_PATH)) {
    known = JSON.parse(readFileSync(KNOWN_TARGETS_PATH, 'utf-8'));
  }

  const seen = new Set(known.map(t => t.url));
  let merged = 0;

  for (const { file, region } of STATIC_DIRS) {
    const filePath = join(ROOT_DIR, file);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, 'utf-8');
    const blocks = content.match(/\[\[targets\]\]\n[\s\S]*?(?=\[\[targets\]\]|$)/g) || [];

    for (const block of blocks) {
      const name = block.match(/name\s*=\s*"([^"]+)"/)?.[1];
      const url = block.match(/url\s*=\s*"([^"]+)"/)?.[1];
      if (!name || !url || seen.has(url)) continue;

      known.push({
        name,
        url,
        type: region === 'ngos' ? 'ngo' : 'enterprise',
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

  if (merged > 0) {
    mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
    writeFileSync(KNOWN_TARGETS_PATH, JSON.stringify(known, null, 2));
  }

  console.log(`📋 Static targets merged: ${merged} (total known: ${known.length})`);
}

try {
  main();
} catch (error) {
  console.error('Fatal error:', error);
  process.exit(1);
}
