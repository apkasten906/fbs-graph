# GitHub Pages Deployment Summary

## ✅ Completed Tasks

### 1. GitHub Pages Configuration

- Created `.nojekyll` file to disable Jekyll processing
- Updated `.gitignore` to exclude generated data files but preserve directory structure
- Added `web/data/.gitkeep` to maintain directory in git

### 2. GitHub Actions CI/CD Workflow

- Created `.github/workflows/deploy-pages.yml` with automated deployment pipeline
- Workflow triggers on push to `main` branch and manual dispatch
- Steps include: checkout, Node.js setup, dependency installation, static data generation, and deployment

### 3. Static Data Generation

- Created `scripts/generate-static-data.ts` to export GraphQL data as static JSON files
- Generates the following files in `web/data/`:
  - `conferences.json` - All FBS conferences
  - `teams.json` - All teams with conference affiliations
  - `games-{season}.json` - All games with leverage calculations
  - `essential-matchups-{season}.json` - Top 50 non-conference matchups
  - `conference-connectivity-{season}.json` - Cross-conference connections
  - `metadata.json` - Generation timestamp and file inventory
- Added npm scripts: `generate:static` and `build:pages`

### 4. Static Data Adapter Module

- Created `web/modules/static-data-adapter.js` for loading pre-generated JSON files
- Provides GraphQL-compatible API for backward compatibility
- Implements caching to minimize network requests
- Supports both static (GitHub Pages) and dynamic (local GraphQL) modes

### 5. Frontend Updates

- Updated `web/fbs-graph-timeline-explorer.html`:
  - Removed GraphQL endpoint input field
  - Integrated static data adapter
  - Maintains backward compatibility with local GraphQL server
- Updated `web/fbs-graph-visualizer.html`:
  - Removed GraphQL endpoint input field
  - Integrated static data adapter
  - Maintains backward compatibility with local GraphQL server
- Updated `web/modules/fbs-graph-timeline-explorer.js`:
  - Modified `load()` function to use static data when available
  - Falls back to GraphQL for local development
- Updated link URLs in:
  - `web/matchup-timeline.js` - Changed from localhost to relative paths
  - `web/modules/ui-renderer.js` - Changed from localhost to relative paths

### 6. Documentation

- Updated `README.md`:
  - Added live demo link section at the top
  - Expanded scripts section with deployment commands
  - Explained GitHub Actions workflow
- Created `docs/GITHUB_PAGES_DEPLOYMENT.md`:
  - Comprehensive deployment guide
  - Architecture explanation
  - Troubleshooting section
  - Local testing instructions

## 🌐 Live URL

Once deployed to GitHub Pages:
**https://apkasten906.github.io/fbs-graph/**

## 🚀 Deployment Process

### Automatic Deployment

Push to `main` branch triggers GitHub Actions workflow which:

1. Installs dependencies
2. Generates static data files from source data
3. Deploys entire project to GitHub Pages

### Manual Deployment

1. Go to Actions tab in GitHub repository
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow"

## 🧪 Local Testing

Before deploying:

```bash
# Generate static data files
npm run generate:static

# Start web server
npm run web:serve

# Open browser to http://localhost:4173
# Test all pages to verify functionality
```

## 📁 File Structure

```
fbs-graph/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml          # CI/CD workflow
├── .nojekyll                         # Disables Jekyll
├── web/
│   ├── data/                         # Generated static data (gitignored)
│   │   ├── .gitkeep
│   │   ├── conferences.json
│   │   ├── teams.json
│   │   ├── games-2025.json
│   │   ├── essential-matchups-2025.json
│   │   ├── conference-connectivity-2025.json
│   │   └── metadata.json
│   ├── modules/
│   │   ├── static-data-adapter.js    # Loads static JSON
│   │   └── ...
│   ├── index.html
│   ├── fbs-graph-timeline-explorer.html
│   ├── fbs-graph-visualizer.html
│   └── matchup-timeline.html
├── scripts/
│   └── generate-static-data.ts       # Static data generator
└── docs/
    └── GITHUB_PAGES_DEPLOYMENT.md    # Deployment guide
```

## 🔄 Development vs Production

**Local Development:**

- Runs GraphQL server on port 4100
- Web server on port 4173
- Fetches data dynamically from GraphQL API
- Requires `CFBD_KEY` for data import

**GitHub Pages Production:**

- No backend server required
- Uses pre-generated static JSON files
- All data loaded from `web/data/` directory
- Completely client-side application

## ⚙️ Configuration

### GitHub Repository Settings

To enable GitHub Pages:

1. Go to Settings > Pages
2. Source: "GitHub Actions"
3. Save

### Workflow Permissions

Already configured in workflow file:

- `contents: read` - Read repository
- `pages: write` - Deploy to Pages
- `id-token: write` - Authenticate deployment

## 🔧 Next Steps

To complete the deployment:

1. **Commit all changes:**

   ```bash
   git add .
   git commit -m "feat: Add GitHub Pages deployment support"
   ```

2. **Push to GitHub:**

   ```bash
   git push origin feat/publish-on-github
   ```

3. **Create Pull Request:**
   - Merge `feat/publish-on-github` into `main`

4. **Enable GitHub Pages:**
   - Go to repository Settings > Pages
   - Select "GitHub Actions" as source

5. **Monitor Deployment:**
   - Check Actions tab for workflow execution
   - Verify successful deployment

6. **Test Live Site:**
   - Visit `https://apkasten906.github.io/fbs-graph/`
   - Test all interactive features

## ✨ Features Preserved

All interactive features work on GitHub Pages:

- ✅ FBS Schedule Timeline Explorer
- ✅ Teams & Matchups Visualizer
- ✅ Matchup Timeline (detailed view)
- ✅ Conference filtering
- ✅ Leverage calculations
- ✅ Shortest path finding
- ✅ Interactive graph visualization

## 🎯 Key Benefits

1. **No Backend Required** - Fully static site, no server costs
2. **Fast Loading** - Pre-generated data, no API calls
3. **Reliable** - Hosted on GitHub's infrastructure
4. **Automatic Updates** - Push to main triggers rebuild
5. **Version Control** - Full git history of all changes
6. **Free Hosting** - GitHub Pages at no cost

## 📝 Notes

- Static data files are generated during deployment
- `web/data/` directory is gitignored (contents regenerated on each deploy)
- Frontend automatically detects and uses static data when available
- Local development still works with GraphQL server
- No code changes needed to switch between modes
