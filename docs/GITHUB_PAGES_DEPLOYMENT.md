# GitHub Pages Deployment Guide

This guide explains how to deploy the FBS Schedule Graph project to GitHub Pages.

## Overview

The project uses GitHub Actions to automatically build and deploy a static version of the web application to GitHub Pages. The deployment process:

1. Generates static JSON data files from the GraphQL backend
2. Deploys all web assets (HTML, CSS, JS, and data files) to GitHub Pages
3. Makes the interactive visualizations publicly accessible

## Live URL

Once deployed, the site will be available at:
`https://apkasten906.github.io/fbs-graph/`

## Automatic Deployment

The GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) automatically deploys on every push to the `main` branch.

### Workflow Steps

1. **Checkout** - Clones the repository
2. **Setup Node.js** - Installs Node.js 20 and caches npm dependencies
3. **Install dependencies** - Runs `npm ci`
4. **Generate static data** - Runs `npm run generate:static` to create JSON files
5. **Deploy** - Uploads and deploys to GitHub Pages

## Manual Deployment

To manually trigger a deployment:

1. Go to the **Actions** tab in your GitHub repository
2. Select the "Deploy to GitHub Pages" workflow
3. Click **Run workflow** and choose the branch

## Local Testing Before Deployment

Before pushing to trigger a deployment, test locally:

```bash
# Generate static data files
npm run generate:static

# Start a local web server
npm run web:serve

# Open browser to http://localhost:4173
```

Verify that:

- All pages load without errors
- Data is displayed correctly
- Navigation between pages works
- No console errors appear

## GitHub Pages Configuration

### Repository Settings

To enable GitHub Pages:

1. Go to **Settings** > **Pages** in your GitHub repository
2. Under **Source**, select "GitHub Actions"
3. Save the configuration

### Required Permissions

The workflow requires the following permissions (already configured in the workflow file):

- `contents: read` - Read repository contents
- `pages: write` - Deploy to GitHub Pages
- `id-token: write` - Authenticate deployment

## Data Updates

When you update the schedule data:

1. Update CSV files in the `csv/` directory or run data fetch scripts
2. Commit and push to `main` branch
3. GitHub Actions will automatically rebuild and redeploy

## Architecture

### Static Data Generation

The `scripts/generate-static-data.ts` script creates:

- `web/data/conferences.json` - Conference information
- `web/data/teams.json` - Team information with conference affiliations
- `web/data/games-{season}.json` - All games with leverage calculations
- `web/data/essential-matchups-{season}.json` - Top 50 non-conference games
- `web/data/conference-connectivity-{season}.json` - Cross-conference connections
- `web/data/metadata.json` - Generation timestamp and file inventory

### Static Data Adapter

The `web/modules/static-data-adapter.js` module:

- Loads pre-generated JSON files instead of making GraphQL API calls
- Provides a compatibility layer for the existing frontend code
- Caches loaded data to minimize network requests
- Falls back to GraphQL if static data is unavailable (for local development)

## File Structure

```
fbs-graph/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml       # Deployment workflow
├── .nojekyll                      # Disables Jekyll processing
├── web/
│   ├── data/                      # Generated static data (not in git)
│   │   ├── conferences.json
│   │   ├── teams.json
│   │   ├── games-2025.json
│   │   ├── essential-matchups-2025.json
│   │   ├── conference-connectivity-2025.json
│   │   └── metadata.json
│   ├── modules/
│   │   ├── static-data-adapter.js # Loads static JSON files
│   │   └── ...                    # Other modules
│   ├── index.html                 # Landing page
│   ├── fbs-graph-timeline-explorer.html
│   ├── fbs-graph-visualizer.html
│   └── matchup-timeline.html
└── scripts/
    └── generate-static-data.ts    # Generates static JSON files
```

## Troubleshooting

### Deployment Fails

1. Check the **Actions** tab for error messages
2. Verify GitHub Pages is enabled in repository settings
3. Ensure workflow permissions are correct

### Data Not Loading

1. Check browser console for errors
2. Verify `web/data/` directory exists and contains JSON files
3. Check that `metadata.json` references the correct season

### 404 Errors

1. Ensure all paths are relative (no `localhost` URLs)
2. Check that `.nojekyll` file exists in the root
3. Verify file names match exactly (case-sensitive on some systems)

## Development vs Production

The application supports both modes:

**Local Development** (with GraphQL backend):

```bash
npm run dev        # Start GraphQL server
npm run web:serve  # Start web server
```

**GitHub Pages** (static data):

- Uses pre-generated JSON files
- No backend server required
- Automatically loads from `web/data/` directory

The frontend automatically detects which mode to use based on whether `window.staticDataAdapter` is available.

## Updating the Deployment

To modify the deployment process:

1. Edit `.github/workflows/deploy-pages.yml`
2. Test changes in a feature branch
3. Merge to `main` to apply changes

## License

MIT License - See LICENSE file for details
