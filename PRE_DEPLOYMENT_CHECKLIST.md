# Pre-Deployment Checklist

Use this checklist before pushing your changes to ensure everything is ready for GitHub Pages deployment.

## ✅ Pre-Commit Checks

- [x] All npm dependencies are installed (`npm install`)
- [x] Static data has been generated successfully (`npm run generate:static`)
- [x] Web server runs without errors (`npm run web:serve`)
- [x] All web pages load correctly in browser at http://localhost:4173
- [x] No console errors in browser developer tools
- [x] Timeline Explorer displays data correctly
- [x] Graph Visualizer renders and is interactive
- [x] Matchup Timeline shows detailed game information
- [x] Navigation between pages works correctly
- [x] Conference filtering works as expected
- [x] Leverage calculations are displayed properly

## ✅ Files to Commit

Required files for GitHub Pages:

- [ ] `.nojekyll` (disables Jekyll)
- [ ] `.github/workflows/deploy-pages.yml` (CI/CD workflow)
- [ ] `scripts/generate-static-data.ts` (data generator)
- [ ] `web/modules/static-data-adapter.js` (static data loader)
- [ ] `web/data/.gitkeep` (preserves data directory)
- [ ] Updated `.gitignore` (excludes generated JSON files)
- [ ] Updated `package.json` (new npm scripts)
- [ ] Updated `README.md` (deployment documentation)
- [ ] Updated `web/cfb-graph-timeline-explorer.html` (static data support)
- [ ] Updated `web/cfb-graph-visualizer.html` (static data support)
- [ ] Updated `web/modules/cfb-graph-timeline-explorer.js` (static data support)
- [ ] Updated `web/matchup-timeline.js` (relative URLs)
- [ ] Updated `web/modules/ui-renderer.js` (relative URLs)
- [ ] `docs/GITHUB_PAGES_DEPLOYMENT.md` (deployment guide)
- [ ] `DEPLOYMENT_SUMMARY.md` (summary of changes)

## ✅ Git Operations

```bash
# Check status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: Add GitHub Pages deployment support

- Add static data generation script
- Create GitHub Actions deployment workflow
- Implement static data adapter for frontend
- Update web apps to support both GraphQL and static modes
- Add comprehensive deployment documentation
- Configure .gitignore for generated files
- Add .nojekyll for GitHub Pages compatibility"

# Push to feature branch
git push origin feat/publish-on-github
```

## ✅ GitHub Configuration

After pushing, complete these steps on GitHub:

1. **Enable GitHub Pages:**
   - [ ] Go to repository Settings > Pages
   - [ ] Under "Source", select "GitHub Actions"
   - [ ] Save the configuration

2. **Create Pull Request:**
   - [ ] Create PR from `feat/publish-on-github` to `main`
   - [ ] Review all changes
   - [ ] Merge when ready

3. **Monitor Deployment:**
   - [ ] Go to Actions tab
   - [ ] Watch "Deploy to GitHub Pages" workflow execution
   - [ ] Verify all steps complete successfully
   - [ ] Check for any error messages

4. **Test Live Site:**
   - [ ] Visit https://apkasten906.github.io/fbs-graph/
   - [ ] Test Timeline Explorer functionality
   - [ ] Test Graph Visualizer functionality
   - [ ] Test Matchup Timeline functionality
   - [ ] Verify all data loads correctly
   - [ ] Check console for errors (F12 developer tools)

## ✅ Post-Deployment Verification

- [ ] All pages load without 404 errors
- [ ] Images and CSS styles are applied correctly
- [ ] JavaScript modules load successfully
- [ ] Static data files are accessible
- [ ] Interactive features work as expected
- [ ] Performance is acceptable (check Network tab)
- [ ] Mobile responsiveness works correctly

## 🔧 Troubleshooting

If deployment fails:

1. Check GitHub Actions logs for error messages
2. Verify all required files are committed
3. Ensure GitHub Pages is enabled in repository settings
4. Check that workflow permissions are correct
5. Review browser console for client-side errors
6. Verify static data files were generated correctly

## 📝 Additional Notes

- The first deployment may take 5-10 minutes
- Subsequent deployments are typically faster (2-3 minutes)
- Changes to `main` branch trigger automatic redeployment
- You can manually trigger deployment from Actions tab
- Generated data files are NOT committed to git
- Data is regenerated fresh on each deployment

## 🎉 Success Criteria

Your deployment is successful when:

✅ GitHub Actions workflow completes without errors
✅ Live site is accessible at the GitHub Pages URL
✅ All three visualization tools are functional
✅ Data loads and displays correctly
✅ No JavaScript errors in browser console
✅ All interactive features work as expected

---

**Ready to deploy?** Follow the checklist and push your changes!
