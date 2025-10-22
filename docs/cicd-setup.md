# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions for comprehensive CI/CD automation, including testing, building, and deployment to Vercel.

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Trigger:** Push/PR to main or develop branches

**Jobs:**
- **Setup**: Cache dependencies for faster builds
- **Lint**: ESLint code quality checks
- **TypeCheck**: TypeScript compilation verification
- **Test**: Unit, integration, and performance tests (matrix strategy)
- **Build**: Production and development build verification
- **Security**: npm audit for vulnerabilities
- **E2E**: Cypress end-to-end tests (PR only)
- **Quality Gate**: Final validation before merge

**Key Features:**
- Parallel job execution for speed
- Dependency caching (npm modules)
- Matrix testing for different test types
- Code coverage reporting with Codecov
- Build artifact uploads
- Comprehensive quality checks

### 2. CD Pipeline (`cd.yml`)

**Trigger:** Push to main or manual workflow dispatch

**Jobs:**
- **Pre-Deploy**: Environment detection and change verification
- **Build**: Full application build with tests
- **Deploy-Vercel**: Deployment using Vercel CLI
- **Post-Deploy**: Health checks and smoke tests
- **Notify**: Deployment status notifications
- **Rollback**: Automatic rollback on production failures

**Key Features:**
- Environment-aware deployments (production/preview)
- Pre-deployment validation
- Health check retries
- Deployment URL commenting on PRs
- Automatic rollback protection
- Issue creation on failures

### 3. PR Checks (`pr-checks.yml`)

**Trigger:** Pull request events

**Jobs:**
- **PR Info**: Statistics and automated commenting
- **Check Commits**: Conventional commits validation
- **Size Check**: Bundle size comparison
- **Label Check**: PR label validation

**Key Features:**
- PR statistics analysis
- Commit message convention checks
- Bundle size impact analysis
- Label requirement validation

### 4. Scheduled Checks (`scheduled-checks.yml`)

**Trigger:** Daily at 2 AM UTC or manual

**Jobs:**
- **Dependency Audit**: Security vulnerability scanning
- **Dependency Updates**: Outdated package detection
- **Build Health**: Regular build verification
- **Code Quality**: Automated quality metrics

**Key Features:**
- Daily security audits
- Automated issue creation for vulnerabilities
- Dependency update tracking
- Coverage monitoring

## Required Secrets

Configure these in GitHub repository settings:

### Vercel Secrets
- `VERCEL_TOKEN`: Vercel authentication token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID

### Application Secrets
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_WS_URL`: WebSocket server URL

### Optional Secrets
- `CODECOV_TOKEN`: Codecov upload token (for coverage reports)

## Getting Secrets

### Vercel Setup

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Link project:**
   ```bash
   vercel link
   ```

3. **Get project details:**
   ```bash
   vercel project ls
   ```

4. **Create token:**
   - Visit https://vercel.com/account/tokens
   - Create new token with deployment permissions

### GitHub Setup

1. Navigate to repository Settings → Secrets and variables → Actions
2. Add each secret using "New repository secret"
3. Ensure secret names match exactly

## Build Verification Script

**Location:** `/workspaces/love-rank-pulse/scripts/verify-build.js`

**Purpose:** Validates build output after compilation

**Checks:**
- Build directory existence
- Required files (index.html, bundled JS/CSS)
- Index.html structure validation
- Bundle size analysis
- Source map detection (production)
- Total build size reporting

**Usage:**
```bash
node scripts/verify-build.js
```

**Environment Variables:**
- `BUILD_MODE`: production or development (default: production)

## Branch Protection

Recommended branch protection rules for `main`:

1. **Required status checks:**
   - CI Pipeline / quality-gate
   - CD Pipeline / build (for deployments)

2. **Required reviews:**
   - At least 1 approving review
   - Dismiss stale reviews on new commits

3. **Additional protections:**
   - Require branches to be up to date
   - Include administrators
   - Restrict force pushes
   - Restrict deletions

**Setup:**
1. Go to repository Settings → Branches
2. Add branch protection rule for `main`
3. Configure as above

## Deployment Notifications

### Automated Notifications

**PR Comments:**
- Deployment URL on successful preview deployment
- Statistics on PR creation

**GitHub Step Summary:**
- CI pipeline results summary
- Deployment status and URL
- Bundle size comparisons
- Coverage reports

**Issue Creation:**
- Security vulnerabilities (daily checks)
- Production deployment failures
- Critical errors

### Manual Notifications

**Slack Integration (Optional):**
```yaml
# Add to workflow
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Deployment completed: ${{ needs.deploy-vercel.outputs.url }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## Monitoring and Metrics

### Key Metrics Tracked

1. **Build Performance:**
   - Build duration
   - Bundle sizes
   - Cache hit rates

2. **Test Coverage:**
   - Line coverage percentage
   - Branch coverage
   - Uncovered files

3. **Security:**
   - Vulnerability counts by severity
   - Dependency update lag
   - Audit failures

4. **Deployment:**
   - Deployment success rate
   - Health check pass rate
   - Rollback frequency

### Viewing Metrics

- **Actions tab:** Individual workflow runs
- **Insights → Actions:** Overall statistics
- **Step summaries:** Detailed run information
- **Codecov dashboard:** Coverage trends

## Troubleshooting

### Common Issues

**1. Vercel Deployment Fails**
- Verify `VERCEL_TOKEN` is valid
- Check `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`
- Ensure Vercel project is linked

**2. Build Fails**
- Check for TypeScript errors
- Verify all dependencies installed
- Review build logs for specific errors

**3. Tests Fail**
- Check if Prisma client is generated
- Verify test environment variables
- Review individual test failures

**4. Security Audit Fails**
- Run `npm audit fix` locally
- Update vulnerable dependencies
- Document exceptions if needed

### Debug Steps

1. **Local reproduction:**
   ```bash
   npm ci
   npm run prisma:generate
   npm run lint
   npm run build
   npm test
   ```

2. **Check workflow logs:**
   - Click on failed workflow run
   - Expand failed job
   - Review error messages

3. **Re-run workflows:**
   - Use "Re-run jobs" button
   - Try "Re-run failed jobs" first

## Optimization Tips

### Speed Improvements

1. **Cache everything:**
   - npm dependencies
   - Prisma client
   - Build artifacts

2. **Parallel execution:**
   - Use matrix strategies
   - Split independent jobs
   - Avoid unnecessary dependencies

3. **Selective testing:**
   - Run E2E only on PRs
   - Use test splitting for large suites
   - Skip unchanged file tests

### Cost Optimization

1. **Timeout limits:**
   - Set reasonable timeouts
   - Cancel redundant runs

2. **Conditional execution:**
   - Skip builds on docs changes
   - Deploy only on main branch
   - Use path filters

3. **Artifact management:**
   - Set retention periods
   - Only upload necessary files
   - Compress large artifacts

## Maintenance

### Regular Tasks

**Weekly:**
- Review failed workflows
- Update dependencies
- Check security advisories

**Monthly:**
- Audit workflow performance
- Review and optimize caching
- Update CI/CD documentation

**Quarterly:**
- Review branch protection rules
- Audit secret rotation
- Update GitHub Actions versions

### Version Updates

**GitHub Actions:**
```yaml
# Keep actions up to date
- uses: actions/checkout@v4  # Check for v5
- uses: actions/setup-node@v4
- uses: actions/cache@v4
```

**Dependencies:**
```bash
# Regular updates
npm update
npm audit fix
npm outdated
```

## Best Practices

1. **Always test locally first**
2. **Use semantic versioning for actions**
3. **Document workflow changes**
4. **Keep secrets secure and rotated**
5. **Monitor workflow costs**
6. **Review logs regularly**
7. **Use matrix strategies wisely**
8. **Cache aggressively**
9. **Fail fast on critical errors**
10. **Maintain comprehensive docs**

## Resources

- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Codecov Documentation](https://docs.codecov.com)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Support

For issues or questions:
1. Check workflow logs first
2. Review this documentation
3. Search GitHub Issues
4. Create new issue with workflow run link
