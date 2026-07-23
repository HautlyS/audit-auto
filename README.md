# Autit-Auto

> Full Scraper & AI Audit System for US/EU Enterprises and NGOs

Automated website auditing system using Playwright for scraping, OpenCode AI for analysis, and Nuxt 3 for visualization. Runs every 2 hours via GitHub Actions.

## Features

- **Full Web Scraping**: Playwright-based scraper for dynamic sites
- **Reddit & Forum Discovery**: Automatically discovers new targets
- **AI-Powered Audits**: OpenCode CLI headless mode with MiMo free tier
- **Comprehensive Analysis**: Accessibility, SEO, Performance, Security
- **Real-time Dashboard**: Nuxt 3 VueJS dashboard with live data
- **Scheduled Execution**: GitHub Actions cron every 2 hours
- **Parallel Processing**: Concurrent scraping and auditing

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions (2hr cron)                 │
├─────────────────────────────────────────────────────────────┤
│  1. SCRAPE: Playwright browser pool (5 concurrent)         │
│     - Reddit, forums, company sites, NGOs                  │
│     - Extract SEO, a11y, perf, security data               │
│  2. AUDIT: OpenCode CLI headless mode                      │
│     - AI analysis of scraped data                          │
│     - Generate detailed reports                            │
│  3. DEPLOY: Nuxt 3 static site to GitHub Pages             │
│     - Real-time dashboard                                  │
│     - Historical data visualization                        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/hautlys/autit-auto.git
cd autit-auto
npm install
npx playwright install chromium
```

### 2. Configure Secrets

Add these in GitHub repository settings → Secrets:

| Secret | Required | Description |
|--------|----------|-------------|
| `OPENCODE_API_KEY` | No | Optional for free tier |
| `GITHUB_TOKEN` | Yes | Auto-provided by GitHub |

### 3. Deploy Dashboard

```bash
npm run generate
# Deploy dist/ to your hosting
```

## Usage

### Manual Pipeline Run

```bash
# Full pipeline (discover + scrape + audit)
node scripts/pipeline.mjs --all

# Just scraping
node scripts/full-scraper.mjs --audit

# Just AI auditing
node scripts/ai-auditor.mjs --all
```

### Development

```bash
npm run dev
# Dashboard at http://localhost:3000
```

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/pipeline.mjs` | Main orchestrator |
| `scripts/full-scraper.mjs` | Playwright web scraper |
| `scripts/ai-auditor.mjs` | OpenCode AI auditor |
| `scripts/generate-dashboard-data.mjs` | Data aggregator |

## Target Categories

### US Enterprises (20)
Apple, Microsoft, Google, Amazon, Tesla, JPMorgan Chase, Visa, Walmart, UnitedHealth, ExxonMobil, Meta, Netflix, Adobe, Salesforce, Intel, IBM, Oracle, Cisco, Nike, Starbucks

### EU Enterprises (15)
SAP, Siemens, Allianz, BMW, Mercedes-Benz, Volkswagen, ASML, Nestle, Novartis, Unilever, HSBC, Barclays, TotalEnergies, LVMH, Airbus

### NGOs (15)
Earth Guardians, Greenpeace, WWF, Red Cross, Doctors Without Borders, Amnesty International, Human Rights Watch, Oxfam, UNICEF, World Food Programme, Sierra Club, NRDC, The Nature Conservancy, Conservation International, Environmental Defense Fund

## Audit Categories

### Accessibility (WCAG 2.1 AA)
- Color contrast
- Keyboard navigation
- Screen reader compatibility
- ARIA implementation
- Focus management
- Form accessibility

### SEO Analysis
- Title tag optimization
- Meta descriptions
- Header hierarchy
- Internal linking
- Schema markup
- Mobile friendliness

### Performance
- Resource optimization
- Loading patterns
- Third-party impact
- Caching opportunities

### Security
- HTTPS implementation
- Security headers
- Mixed content
- Cookie policies

## Project Structure

```
autit-auto/
├── .github/workflows/        # GitHub Actions
│   └── audit-pipeline.yml    # Main workflow (2hr cron)
├── app/                      # Nuxt 3 dashboard
│   ├── layouts/
│   ├── pages/
│   └── components/
├── scripts/                  # Scraper & auditor
│   ├── pipeline.mjs          # Orchestrator
│   ├── full-scraper.mjs      # Playwright scraper
│   ├── ai-auditor.mjs        # OpenCode AI auditor
│   └── generate-dashboard-data.mjs
├── data/                     # Scraped data
│   ├── targets-us.toml
│   ├── targets-eu.toml
│   └── targets-ngos.toml
├── audits/                   # Audit results (TOML)
├── server/api/               # Nuxt API endpoints
├── config.toml               # Main configuration
└── package.json
```

## GitHub Actions Workflow

The workflow runs every 2 hours with 4 jobs:

1. **scrape**: Playwright browser scraping
2. **audit**: OpenCode AI analysis
3. **deploy**: Nuxt build & GitHub Pages deploy
4. **report**: Summary generation

## Configuration

Edit `config.toml` to customize:

```toml
[schedule]
cron = "0 */2 * * *"  # Every 2 hours
max_sites = 50

[scraper]
concurrency = 5
retries = 3

[opencode]
model = "opencode/grok-code"  # Free tier
```

## Dashboard Features

- Real-time audit results
- Filter by type, region, score
- Historical data visualization
- Issue details and recommendations
- Schedule configuration view

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT

## Acknowledgments

- [OpenCode](https://opencode.ai) - AI CLI tool
- [Playwright](https://playwright.dev) - Browser automation
- [Nuxt 3](https://nuxt.com) - Vue.js framework
- [Earth Guardians](https://www.earthguardians.org) - Audit inspiration
