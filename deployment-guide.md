# Love Rank Pulse - Deployment Guide

This document provides instructions for deploying the Love Rank Pulse project to Vercel.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Vercel Setup](#vercel-setup)
3. [Environment Variables](#environment-variables)
4. [Deployment Process](#deployment-process)
5. [CI/CD with GitHub Actions](#cicd-with-github-actions)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying the Love Rank Pulse project to Vercel, ensure you have the following:

- A Vercel account (sign up at [vercel.com](https://vercel.com))
- Git repository with the Love Rank Pulse project
- Node.js version 18 or higher
- npm or yarn package manager

## Vercel Setup

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Authenticate with Vercel

```bash
vercel login
```

Follow the prompts to authenticate with your Vercel account.

### 3. Link Project to Vercel

Navigate to your project directory and run:

```bash
vercel link
```

This will link your local project to a Vercel project.

## Environment Variables

The following environment variables are required for the Love Rank Pulse project:

| Variable | Description | Example |
|----------|-------------|---------|
| VITE_API_URL | URL of the API backend | https://api.loverankpulse.com |
| VITE_AUTH_DOMAIN | Authentication domain | auth.loverankpulse.com |
| VITE_AUTH_CLIENT_ID | Authentication client ID | your-auth-client-id |
| VITE_AUTH_AUDIENCE | Authentication audience | your-auth-audience |
| VITE_ENABLE_REAL_TIME_UPDATES | Enable real-time updates | true |
| VITE_ENABLE_COUNTRY_LEADERBOARDS | Enable country leaderboards | true |
| VITE_ENABLE_SESSION_LEADERBOARDS | Enable session leaderboards | true |
| VITE_ANALYTICS_ID | Analytics ID | your-analytics-id |

These variables can be set in the Vercel dashboard under Project Settings > Environment Variables, or using the Vercel CLI:

```bash
vercel env add VITE_API_URL
```

## Deployment Process

### Manual Deployment

To deploy the project manually:

1. Ensure all changes are committed to your Git repository
2. Run the following command:

```bash
vercel --prod
```

This will build and deploy your project to Vercel's production environment.

### Automatic Deployment

The project is configured for automatic deployment using GitHub integration:

1. Push changes to the `main` branch
2. Vercel will automatically build and deploy the project
3. Preview deployments are created for pull requests

## CI/CD with GitHub Actions

The project includes a GitHub Actions workflow for CI/CD integration with Vercel. The workflow is defined in `.github/workflows/vercel-deploy.yml` and performs the following steps:

1. **Test**: Runs linting and tests
2. **Build**: Builds the application
3. **Deploy Preview**: Deploys a preview environment for pull requests
4. **Deploy Production**: Deploys to production when changes are merged to the main branch

### Required Secrets

The following secrets must be configured in your GitHub repository:

- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

To obtain these values:

1. Generate a Vercel token in your Vercel account settings
2. Run `vercel whoami` to get your organization ID
3. Run `vercel projects ls` to get your project ID

## Troubleshooting

### Build Failures

If the build fails, check the following:

1. Verify that all dependencies are installed
2. Check for linting or TypeScript errors
3. Review the build logs in the Vercel dashboard

### Environment Variable Issues

If the application is not working correctly after deployment:

1. Verify that all required environment variables are set
2. Check that the environment variables are correctly referenced in the code
3. Ensure that the environment variables are prefixed with `VITE_` for client-side access

### Deployment Timeouts

If the deployment times out:

1. Check if the build process is taking too long
2. Optimize the build process by reducing bundle size
3. Contact Vercel support if the issue persists