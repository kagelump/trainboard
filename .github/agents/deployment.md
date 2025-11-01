# CI/CD and Deployment Agent Instructions

## GitHub Actions Workflow

### Workflow File
`.github/workflows/deploy.yml` - Automated build and deployment to GitHub Pages

### Trigger
- **Event**: Push to `main` branch
- **Manual**: Can be triggered manually from Actions tab

### Workflow Steps
1. **Checkout**: Uses `actions/checkout@v4`
2. **Setup Node.js**: Uses `actions/setup-node@v4` with Node.js 22
3. **Install**: Runs `npm ci` for clean dependency installation
4. **Build**: Runs `npm run build` to create production assets
5. **Deploy**: Uses `peaceiris/actions-gh-pages@v3` to deploy `dist/` to `gh-pages` branch

### Permissions
```yaml
permissions:
  contents: write  # Required for deploying to gh-pages branch
```

## Build Process

### Vite Build
```bash
npm run build
```

#### What It Does
- Compiles TypeScript to JavaScript
- Bundles all modules into optimized assets
- Minifies code for production
- Generates source maps
- Copies `index.html` to `dist/`
- Outputs to `dist/` directory

#### Build Output
```
dist/
├── index.html                   # Main HTML file
├── assets/
│   ├── index-[hash].css        # Bundled styles
│   └── index-[hash].js         # Bundled JavaScript
```

#### Build Configuration (vite.config.ts)
- **Base Path**: `'./'` (relative paths for GitHub Pages)
- **Minification**: Enabled
- **Source Maps**: Generated
- **Asset Hashing**: Enabled for cache busting

## GitHub Pages Deployment

### Deployment Target
- **Branch**: `gh-pages`
- **Source**: `dist/` directory
- **URL**: `https://<username>.github.io/<repo-name>/`

### Deployment Tool
Uses `peaceiris/actions-gh-pages@v3` action:
```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist
```

### Deployment Process
1. Action builds the site
2. Contents of `dist/` are copied to `gh-pages` branch
3. GitHub Pages serves the site from `gh-pages` branch
4. Site is accessible at the GitHub Pages URL

### First-Time Setup
1. Enable GitHub Pages in repository settings
2. Set source to `gh-pages` branch
3. Push to `main` to trigger deployment
4. Wait for workflow to complete
5. Access site at GitHub Pages URL

## Local Deployment

### Manual Deployment
```bash
npm run deploy
```

#### What It Does
1. Runs `npm run build` to create production build
2. Uses `gh-pages` package to push `dist/` to `gh-pages` branch
3. Requires Git credentials and push permissions

#### When to Use
- Testing deployment process locally
- Manual deployment when CI is unavailable
- Quick updates without going through CI

## Environment Configuration

### No Secrets Required
- Uses `GITHUB_TOKEN` (automatically provided by GitHub Actions)
- No additional secrets needed for basic deployment
- API keys should NOT be committed (use runtime config)

### Configuration Files
- `config.json`: Local configuration (not committed)
- `config.example.json`: Example configuration (committed)
- API keys stored in `config.json` or localStorage (not in repo)

## Build Artifacts

### What Gets Built
- TypeScript → JavaScript (ES modules)
- Styles → Minified CSS
- Assets → Hashed filenames
- HTML → Processed with asset references

### What's NOT Included
- Source `.ts` files
- `node_modules/`
- Development dependencies
- Test files
- Configuration files (except example)

## Troubleshooting CI/CD

### Build Failures

#### TypeScript Errors
```bash
# Run locally to check
npm run typecheck
```
**Fix**: Resolve TypeScript errors before pushing

#### Test Failures
```bash
# Run locally to check
npm test
```
**Fix**: Ensure all tests pass before pushing

#### Dependency Issues
```bash
# Verify lockfile is committed
git status package-lock.json
```
**Fix**: Commit `package-lock.json` changes

#### Build Errors
```bash
# Test build locally
npm run build
```
**Fix**: Resolve build errors shown in output

### Deployment Failures

#### Permission Issues
- **Symptom**: "Permission denied" or "403 Forbidden"
- **Fix**: Ensure `permissions: contents: write` in workflow

#### Branch Issues
- **Symptom**: `gh-pages` branch doesn't exist
- **Fix**: First run creates it automatically

#### Pages Not Updating
- **Symptom**: Old content still showing
- **Fix**: Check GitHub Pages settings, clear browser cache

## Monitoring Deployments

### GitHub Actions Tab
- View all workflow runs
- Check build logs
- See deployment status
- Debug failures

### Workflow Status
- ✓ Green: Successful deployment
- ✗ Red: Failed (click for details)
- ○ Yellow: In progress

### Logs
1. Go to Actions tab
2. Click on workflow run
3. Click on "build" job
4. Expand steps to see logs
5. Check for errors or warnings

## Best Practices

### Before Pushing to Main
1. Test locally: `npm run dev`
2. Run tests: `npm test`
3. Type check: `npm run typecheck`
4. Build: `npm run build`
5. Test built site: `npm run preview`

### Commit Practices
- Don't commit `dist/` (built by CI)
- Don't commit `node_modules/`
- Don't commit `config.json` (secrets)
- Do commit `package-lock.json`
- Do commit source code changes

### Branch Strategy
- **main**: Production branch (triggers deployment)
- **feature branches**: Development work
- **gh-pages**: Deployment target (managed by CI)

### Deployment Checklist
- [ ] Tests pass locally
- [ ] Build succeeds locally
- [ ] TypeScript compiles without errors
- [ ] No console errors in built site
- [ ] Changes committed to feature branch
- [ ] PR reviewed and approved
- [ ] Merge to `main` branch
- [ ] Monitor workflow execution
- [ ] Verify deployment success
- [ ] Test live site

## Rollback Procedure

### If Deployment Breaks Site
1. Identify last working commit
2. Create new branch from that commit
3. Push to `main` (or revert commit)
4. Wait for CI to redeploy
5. Verify site is working

### Emergency Rollback
```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push --force origin main  # Use with caution
```

## Optimization

### Build Performance
- Build time: ~2-3 seconds (Vite is fast)
- Use `npm ci` in CI (faster than `npm install`)
- Cache `node_modules` in workflow (optional)

### Bundle Size
- Monitor `dist/` size after changes
- Current bundle: ~13KB JS (gzipped: ~5KB)
- Keep dependencies minimal
- Use code splitting if needed

### Deployment Speed
- Total workflow time: ~30-60 seconds
- Fastest: Node.js setup + npm ci + build + deploy
- No unnecessary steps

## Workflow Customization

### Modifying the Workflow
File: `.github/workflows/deploy.yml`

#### Change Node.js Version
```yaml
- name: Use Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'  # Change this
```

#### Add Build Steps
```yaml
- name: Custom Build Step
  run: npm run custom-command
```

#### Change Deploy Branch
```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist
    publish_branch: custom-branch  # Add this
```

## Multiple Environments

### Current Setup
- **Production**: Deployed from `main` to GitHub Pages

### Adding Staging (Optional)
1. Create `staging` branch
2. Add separate workflow for staging
3. Deploy to different GitHub Pages or hosting
4. Test on staging before promoting to production

## Security Considerations

### API Keys
- **Never** commit API keys to repository
- Use `config.json` locally (in `.gitignore`)
- Provide `config.example.json` as template
- Users supply their own keys

### Dependencies
- Regularly update dependencies
- Review security advisories
- Use `npm audit` to check vulnerabilities
- Keep Node.js version current

### Workflow Security
- Use pinned action versions (e.g., `@v4` not `@latest`)
- Review third-party actions before use
- Limit workflow permissions to minimum required
- Don't expose secrets in logs
