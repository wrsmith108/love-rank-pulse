# GitHub Repository Setup Guide

## Quick Start Checklist

- [ ] Configure GitHub Secrets
- [ ] Set up Branch Protection Rules
- [ ] Enable GitHub Actions
- [ ] Configure Vercel Integration
- [ ] Test CI/CD Pipeline

## 1. GitHub Secrets Configuration

### Required Secrets

Navigate to: **Repository → Settings → Secrets and variables → Actions → New repository secret**

#### Vercel Secrets

1. **VERCEL_TOKEN**
   ```bash
   # Create token at: https://vercel.com/account/tokens
   # Copy the token and add as secret
   ```
   - Click "Create Token"
   - Name: `GitHub Actions CI/CD`
   - Scope: `Full Account`
   - Expiration: `No Expiration` (or set according to policy)
   - Copy token immediately (shown only once)

2. **VERCEL_ORG_ID**
   ```bash
   # Get your Organization ID
   npx vercel link
   # Check .vercel/project.json for "orgId"
   cat .vercel/project.json | grep orgId
   ```

3. **VERCEL_PROJECT_ID**
   ```bash
   # From same .vercel/project.json file
   cat .vercel/project.json | grep projectId
   ```

#### Application Environment Secrets

4. **VITE_API_BASE_URL**
   ```
   Production: https://your-backend-api.com/api
   Preview: https://api-preview.your-domain.com/api
   ```

5. **VITE_WS_URL**
   ```
   Production: wss://your-backend-api.com
   Preview: wss://api-preview.your-domain.com
   ```

#### Optional Secrets

6. **CODECOV_TOKEN** (for coverage reports)
   - Sign up at https://codecov.io
   - Add repository
   - Copy upload token
   - Add as GitHub secret

### Vercel CLI Setup

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Link project (run in project root)
vercel link

# This creates .vercel/project.json with IDs
# Extract the IDs for GitHub secrets:
cat .vercel/project.json
```

**Example .vercel/project.json:**
```json
{
  "orgId": "team_xxxxxxxxxxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxxxxxxxxxx"
}
```

### Alternative: Vercel Dashboard Method

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings → General**
4. Copy **Project ID**
5. Go to **Settings → Team** (or Account)
6. Copy **Team ID** (this is your Org ID)

## 2. Branch Protection Rules

### Main Branch Protection

Navigate to: **Repository → Settings → Branches → Add branch protection rule**

#### Rule Configuration

**Branch name pattern:** `main`

**Protect matching branches:**

✅ **Require a pull request before merging**
- Require approvals: `1`
- Dismiss stale pull request approvals when new commits are pushed
- Require review from Code Owners (if CODEOWNERS file exists)

✅ **Require status checks to pass before merging**
- Require branches to be up to date before merging

**Required status checks:**
- `CI Pipeline / quality-gate`
- `CI Pipeline / lint`
- `CI Pipeline / typecheck`
- `CI Pipeline / test`
- `CI Pipeline / build`
- `CI Pipeline / security`

✅ **Require conversation resolution before merging**

✅ **Require signed commits** (recommended for security)

✅ **Require linear history** (optional, prevents merge commits)

✅ **Include administrators**

✅ **Restrict who can push to matching branches** (optional)
- Add specific teams/users if needed

✅ **Allow force pushes** ❌ (disabled)

✅ **Allow deletions** ❌ (disabled)

### Develop Branch Protection (Optional)

**Branch name pattern:** `develop`

**Lighter protection:**
- Require 1 approval
- Require status checks (CI only, not deployment)
- Allow force pushes from specific users (for rebasing)

## 3. GitHub Actions Configuration

### Enable Actions

Navigate to: **Repository → Settings → Actions → General**

**Actions permissions:**
- ✅ Allow all actions and reusable workflows

**Workflow permissions:**
- ✅ Read and write permissions
- ✅ Allow GitHub Actions to create and approve pull requests

**Fork pull request workflows:**
- ✅ Require approval for first-time contributors

### Environment Configuration

Navigate to: **Repository → Settings → Environments**

#### Production Environment

1. **Create environment:** `production`
2. **Protection rules:**
   - ✅ Required reviewers (add team/users)
   - ✅ Wait timer: `0` minutes (or add delay)
   - Deployment branches: `main` only
3. **Environment secrets** (if different from repo):
   - VITE_API_BASE_URL (production URL)
   - VITE_WS_URL (production WebSocket URL)

#### Preview Environment

1. **Create environment:** `preview`
2. **Protection rules:**
   - No required reviewers
   - Deployment branches: All branches
3. **Environment secrets:**
   - VITE_API_BASE_URL (preview URL)
   - VITE_WS_URL (preview WebSocket URL)

## 4. CODEOWNERS File (Optional)

Create `/workspaces/love-rank-pulse/.github/CODEOWNERS`:

```
# Default owners for everything
* @your-username

# Workflow files require team review
/.github/workflows/ @your-team/devops

# CI/CD configuration
/scripts/ @your-team/devops
/vercel.json @your-team/devops

# Database changes
/prisma/ @your-team/backend

# Frontend components
/src/components/ @your-team/frontend
```

## 5. Repository Settings

### General Settings

Navigate to: **Repository → Settings → General**

**Features:**
- ✅ Issues
- ✅ Projects (for project boards)
- ✅ Discussions (optional)

**Pull Requests:**
- ✅ Allow squash merging (recommended)
- ❌ Allow merge commits (optional)
- ❌ Allow rebase merging (optional)
- ✅ Always suggest updating pull request branches
- ✅ Automatically delete head branches

**Archives:**
- ❌ Include Git LFS objects in archives

### Labels Configuration

Create these standard labels:

| Label | Color | Description |
|-------|-------|-------------|
| `feature` | `#0E8A16` | New feature implementation |
| `bugfix` | `#D73A4A` | Bug fix |
| `hotfix` | `#B60205` | Critical production fix |
| `chore` | `#FEF2C0` | Maintenance tasks |
| `docs` | `#0075CA` | Documentation updates |
| `dependencies` | `#0366D6` | Dependency updates |
| `security` | `#D93F0B` | Security-related changes |
| `urgent` | `#B60205` | Requires immediate attention |
| `deployment` | `#1D76DB` | Deployment-related |
| `production` | `#0E8A16` | Production environment |

### Webhooks (Optional)

Navigate to: **Repository → Settings → Webhooks**

Configure webhooks for:
- Slack notifications
- Discord notifications
- Custom monitoring systems

## 6. Testing the Setup

### Test CI Pipeline

1. **Create test branch:**
   ```bash
   git checkout -b test/ci-pipeline
   ```

2. **Make a small change:**
   ```bash
   echo "# CI Test" >> README.md
   git add README.md
   git commit -m "test: verify CI pipeline"
   git push origin test/ci-pipeline
   ```

3. **Create Pull Request:**
   - Go to GitHub repository
   - Create PR from `test/ci-pipeline` to `main`
   - Watch CI checks run

4. **Verify all checks pass:**
   - Lint
   - TypeCheck
   - Tests (unit, integration, performance)
   - Build (production, development)
   - Security audit
   - PR checks

### Test CD Pipeline

1. **Merge to main** (after CI passes)

2. **Watch deployment:**
   - Go to Actions tab
   - Click on "CD Pipeline" workflow
   - Monitor deployment progress

3. **Verify deployment:**
   - Check deployment URL in workflow output
   - Visit deployed site
   - Verify health checks passed

### Common Issues and Solutions

#### Issue: Vercel deployment fails with "Project not found"

**Solution:**
```bash
# Re-link project
vercel link --yes

# Update GitHub secrets with new IDs
cat .vercel/project.json
```

#### Issue: Status checks don't appear on PR

**Solution:**
- Ensure workflows exist in target branch (main)
- Check Actions are enabled
- Verify workflow syntax is correct
- Push workflows to main first, then create PR

#### Issue: Secrets not available in workflows

**Solution:**
- Check secret names match exactly (case-sensitive)
- Verify secrets exist in correct scope (repo vs environment)
- Check workflow has correct permissions

#### Issue: Build fails with missing environment variables

**Solution:**
```yaml
# Add to workflow env section
env:
  VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
  VITE_WS_URL: ${{ secrets.VITE_WS_URL }}
```

## 7. Security Best Practices

### Secret Management

1. **Rotate secrets regularly** (quarterly recommended)
2. **Use environment-specific secrets** when needed
3. **Never commit secrets** to repository
4. **Use GitHub secret scanning** (enable in settings)
5. **Audit secret access** regularly

### Access Control

1. **Limit who can approve PRs**
2. **Require 2FA for all contributors**
3. **Review collaborator access monthly**
4. **Use teams for permission management**
5. **Enable security advisories**

### Workflow Security

1. **Pin action versions** (use @v4, not @main)
2. **Review action permissions** before use
3. **Use least-privilege principle**
4. **Enable dependency review**
5. **Monitor workflow runs**

## 8. Monitoring and Maintenance

### Weekly Tasks

- [ ] Review failed workflows
- [ ] Check for stale branches
- [ ] Review open PRs
- [ ] Check security advisories

### Monthly Tasks

- [ ] Audit collaborator access
- [ ] Review and update dependencies
- [ ] Check workflow performance
- [ ] Update documentation
- [ ] Rotate sensitive tokens

### Quarterly Tasks

- [ ] Comprehensive security audit
- [ ] Review and update branch protection
- [ ] Optimize workflow costs
- [ ] Update CI/CD documentation
- [ ] Review access logs

## 9. Additional Resources

### Documentation
- [GitHub Actions Docs](https://docs.github.com/actions)
- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Branch Protection Docs](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)

### Tools
- [act](https://github.com/nektos/act) - Run GitHub Actions locally
- [actionlint](https://github.com/rhysd/actionlint) - Lint workflow files
- [Vercel CLI](https://vercel.com/cli) - Deploy and manage from terminal

### Community
- [GitHub Community](https://github.community/)
- [Vercel Discord](https://vercel.com/discord)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)

## 10. Support

If you encounter issues:

1. **Check workflow logs** in Actions tab
2. **Review this documentation**
3. **Search GitHub Issues**
4. **Create detailed issue** with:
   - Workflow run link
   - Error messages
   - Steps to reproduce
   - Environment details

---

**Setup Complete!** Your CI/CD pipeline is now ready for use. 🚀
