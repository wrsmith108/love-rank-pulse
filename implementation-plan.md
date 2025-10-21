# Love Rank Pulse - Implementation Plan

## Overview

This document outlines the implementation plan for the Love Rank Pulse project, a real-time leaderboard system for a multiplayer shooter game. The implementation follows the London School TDD methodology with cross-linked documentation, proper data schema planning, and CI/CD workflows.

## Table of Contents

1. [Introduction](#introduction)
2. [London School TDD Methodology](#london-school-tdd-methodology)
3. [System Architecture](#system-architecture)
4. [Data Schema](#data-schema)
5. [Testing Strategy](#testing-strategy)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Branch-Based Development](#branch-based-development)
8. [Implementation Milestones](#implementation-milestones)
9. [Vercel Deployment](#vercel-deployment)
10. [Local Build Verification](#local-build-verification)
11. [Cross-Linked Documentation](#cross-linked-documentation)
12. [Appendices](#appendices)

## Introduction

Love Rank Pulse is a real-time leaderboard system for a multiplayer shooter game that displays player rankings across three scopes: current match (session), country, and global. The system is designed as a microservices architecture with the following components:

1. **Player Service**: Manages player profiles, authentication, and session management
2. **Match Service**: Processes match results and calculates player statistics
3. **Leaderboard Service**: Aggregates statistics and maintains leaderboards across three scopes
4. **API Gateway**: Single entry point for frontend applications

The frontend is implemented using:
- React with TypeScript
- Tailwind CSS for styling
- Shadcn UI components
- Vite as the build tool

## London School TDD Methodology

The London School TDD methodology, also known as "mockist" or "outside-in" TDD, will guide our implementation approach. This methodology focuses on testing behavior rather than state and uses mocks for dependencies.

### Key Principles

- [ ] Start with high-level acceptance tests that describe the system's behavior from the user's perspective
- [ ] Work inward by implementing the outer-most layer first, mocking dependencies
- [ ] Use mocks to define the expected interactions between components
- [ ] Implement inner components to satisfy the expectations set by the mocks
- [ ] Focus on behavior verification rather than state verification

### Implementation Flow

1. **Write Acceptance Tests**: Define the expected behavior of the system from the user's perspective
2. **Create Interface Mocks**: Define the interfaces for components and create mocks for dependencies
3. **Implement Outer Layer**: Implement the outer layer (UI, API endpoints) using the mocks
4. **Test Inner Components**: Write unit tests for inner components based on the expectations set by the mocks
5. **Implement Inner Components**: Implement the inner components to satisfy the tests
6. **Integration Testing**: Verify that the components work together as expected

## System Architecture

The Love Rank Pulse system follows a microservices architecture as defined in the [architecture-plan.md](architecture-plan.md) document. The key components are:

### Frontend

- [ ] React application with TypeScript
- [ ] Tailwind CSS for styling
- [ ] Shadcn UI components
- [ ] Vite as the build tool
- [ ] React Router for navigation
- [ ] React Query for data fetching and caching

### Backend

- [ ] Player Service (Node.js/Express)
- [ ] Match Service (Node.js/Express)
- [ ] Leaderboard Service (Node.js/Express)
- [ ] API Gateway (Node.js/Express)

### Infrastructure

- [ ] PostgreSQL for relational data
- [ ] Redis for caching and real-time leaderboards
- [ ] Docker for containerization
- [ ] GitHub Actions for CI/CD

## Data Schema

The data schema is designed to support the requirements of the Love Rank Pulse system across all components. This schema will be referenced by the frontend, backend services, API, and database.

### Player Schema

```typescript
interface Player {
  id: string;                // UUID
  username: string;          // Display name
  email: string;             // For authentication
  password: string;          // Hashed password
  country_code: string;      // ISO 3166-1 alpha-2
  created_at: Date;
  updated_at: Date;
}
```

### Match Schema

```typescript
interface Match {
  id: string;                // UUID
  start_time: Date;
  end_time: Date;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: Date;
  updated_at: Date;
}
```

### Match Result Schema

```typescript
interface MatchResult {
  id: string;                // UUID
  match_id: string;          // Reference to Match
  player_id: string;         // Reference to Player
  kills: number;
  deaths: number;
  win: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### Leaderboard Entry Schema

```typescript
interface LeaderboardEntry {
  id: string;                // UUID
  player_id: string;         // Reference to Player
  scope: 'session' | 'country' | 'global';
  time_period: 'session' | 'hour' | 'day' | 'all';
  rank: number;
  kills: number;
  deaths: number;
  kd_ratio: number;
  wins: number;
  losses: number;
  win_rate: number;
  created_at: Date;
  updated_at: Date;
}
```

### Database Schema

- [ ] Implement Player table in PostgreSQL
- [ ] Implement Match table in PostgreSQL
- [ ] Implement MatchResult table in PostgreSQL
- [ ] Implement LeaderboardEntry table in PostgreSQL
- [ ] Set up Redis for caching leaderboard data

### Prisma Schema

```prisma
// This is a simplified version of the Prisma schema
model Player {
  id          String   @id @default(uuid())
  username    String   @unique
  email       String   @unique
  password    String
  countryCode String   @map("country_code")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  matchResults MatchResult[]
  leaderboardEntries LeaderboardEntry[]
}

model Match {
  id        String   @id @default(uuid())
  startTime DateTime @map("start_time")
  endTime   DateTime? @map("end_time")
  status    String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  matchResults MatchResult[]
}

model MatchResult {
  id        String   @id @default(uuid())
  matchId   String   @map("match_id")
  playerId  String   @map("player_id")
  kills     Int
  deaths    Int
  win       Boolean
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  match     Match    @relation(fields: [matchId], references: [id])
  player    Player   @relation(fields: [playerId], references: [id])
}

model LeaderboardEntry {
  id          String   @id @default(uuid())
  playerId    String   @map("player_id")
  scope       String
  timePeriod  String   @map("time_period")
  rank        Int
  kills       Int
  deaths      Int
  kdRatio     Float    @map("kd_ratio")
  wins        Int
  losses      Int
  winRate     Float    @map("win_rate")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  player      Player   @relation(fields: [playerId], references: [id])
}
```

## Testing Strategy

The testing strategy follows the London School TDD methodology, with a focus on behavior verification and outside-in testing.

### Frontend Testing

- [ ] **Framework**: Vitest with React Testing Library
- [ ] **Acceptance Tests**: Test user flows and interactions
- [ ] **Component Tests**: Test individual components with mocked dependencies
- [ ] **Integration Tests**: Test component integration
- [ ] **E2E Tests**: Test the complete application flow

### Backend Testing

- [ ] **Framework**: Jest
- [ ] **Unit Tests**: Test individual functions and methods
- [ ] **Integration Tests**: Test API endpoints with mocked dependencies
- [ ] **E2E Tests**: Test the complete API flow

### Test Implementation Strategy

1. **Write Acceptance Tests First**:
   ```typescript
   // Example acceptance test for the leaderboard page
   test('displays global leaderboard when global tab is clicked', async () => {
     // Arrange
     render(<App />);
     
     // Act
     await userEvent.click(screen.getByText('Global'));
     
     // Assert
     expect(screen.getByText('Global Leaderboard')).toBeInTheDocument();
     expect(screen.getByText('Player123')).toBeInTheDocument();
   });
   ```

2. **Mock Dependencies**:
   ```typescript
   // Example mock for the leaderboard service
   const leaderboardServiceMock = {
     getGlobalLeaderboard: jest.fn().mockResolvedValue([
       { rank: 1, player_id: 'player123', kills: 10, deaths: 2, kd_ratio: 5.0 }
     ])
   };
   ```

3. **Implement Components Using Mocks**:
   ```typescript
   // Example component implementation using mocks
   function LeaderboardPage({ leaderboardService }) {
     const [leaderboard, setLeaderboard] = useState([]);
     
     useEffect(() => {
       leaderboardService.getGlobalLeaderboard()
         .then(data => setLeaderboard(data));
     }, [leaderboardService]);
     
     return (
       <div>
         <h1>Global Leaderboard</h1>
         <LeaderboardTable data={leaderboard} />
       </div>
     );
   }
   ```

4. **Test Inner Components**:
   ```typescript
   // Example test for an inner component
   test('calculates KD ratio correctly', () => {
     // Arrange
     const matchResult = { kills: 10, deaths: 2 };
     
     // Act
     const kdRatio = calculateKDRatio(matchResult);
     
     // Assert
     expect(kdRatio).toBe(5.0);
   });
   ```

5. **Implement Inner Components**:
   ```typescript
   // Example implementation of an inner component
   function calculateKDRatio(matchResult) {
     return matchResult.deaths === 0 
       ? matchResult.kills 
       : matchResult.kills / matchResult.deaths;
   }
   ```

### Test Coverage Goals

- [ ] Frontend: 80% code coverage
- [ ] Backend: 90% code coverage
- [ ] Critical paths: 100% code coverage

## CI/CD Pipeline

The CI/CD pipeline will be implemented using GitHub Actions to automate testing, building, and deployment processes.

### CI Workflow

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm test
      - name: Build
        run: npm run build
      - name: Verify build output
        run: node ./scripts/verify-build.js

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Verify build output
        run: node ./scripts/verify-build.js
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: dist
      - name: Create build verification report
        run: node ./scripts/create-build-report.js
        if: success()
      - name: Upload build verification report
        uses: actions/upload-artifact@v3
        with:
          name: build-verification-report
          path: build-report.json
```

### CD Workflow

```yaml
name: CD

on:
  push:
    branches: [ main ]

jobs:
  verify_build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Verify build output
        run: node ./scripts/verify-build.js
      - name: Create build verification report
        run: node ./scripts/create-build-report.js
        if: success()
      - name: Upload build verification report
        uses: actions/upload-artifact@v3
        with:
          name: build-verification-report
          path: build-report.json

  deploy_backend:
    needs: verify_build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy backend to production
        run: |
          # Deploy backend services to production environment
          echo "Deploying backend to production..."

  deploy_frontend:
    needs: verify_build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./
          vercel-args: '--prod'
```

### CI/CD Implementation Tasks

- [ ] Set up GitHub Actions workflow for CI
- [ ] Configure test automation
- [ ] Set up build process
- [ ] Implement local build verification checks
- [ ] Configure deployment to staging environment
- [ ] Configure deployment to production environment
- [ ] Set up Vercel integration for frontend deployment
- [ ] Configure build verification as a prerequisite for deployment

## Branch-Based Development

The branch-based development process ensures that code is properly reviewed and tested before being merged into the main branch.

### Branch Strategy

- [ ] `main`: Production-ready code
- [ ] `develop`: Integration branch for feature development
- [ ] `feature/*`: Feature branches for new features
- [ ] `bugfix/*`: Bugfix branches for fixing issues
- [ ] `release/*`: Release branches for preparing releases

### Development Workflow

1. **Create Feature Branch**:
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/new-feature
   ```

2. **Implement Feature with TDD**:
   - Write tests first
   - Implement feature to pass tests
   - Refactor code as needed

3. **Create Pull Request**:
   - Push feature branch to GitHub
   - Create pull request to develop branch
   - Assign reviewers

4. **Code Review**:
   - Reviewers check code quality
   - Reviewers verify tests
   - Reviewers approve or request changes

5. **Merge to Develop**:
   - CI pipeline runs tests
   - If tests pass, merge to develop
   - Delete feature branch

6. **Release Process**:
   - Create release branch from develop
   - Run final tests
   - Merge to main
   - Tag release

### Branch Protection Rules

- [ ] Require pull request reviews before merging
- [ ] Require status checks to pass before merging
- [ ] Require branches to be up to date before merging
- [ ] Do not allow bypassing the above settings

## Implementation Milestones

The implementation plan is organized into logical milestones without specific timeframes. Each milestone includes specific tasks for each component of the system.

### Milestone 1: Project Setup and Infrastructure

- [ ] Set up project repositories
- [ ] Configure development environment
- [ ] Set up CI/CD pipeline
- [ ] Configure database schemas
- [ ] Set up Docker containers

### Milestone 2: Core Backend Services

#### Player Service
- [ ] Define API contracts
- [ ] Implement player authentication
- [ ] Implement player profile management
- [ ] Implement session management

#### Match Service
- [ ] Define API contracts
- [ ] Implement match creation
- [ ] Implement match result processing
- [ ] Implement match statistics calculation

#### Leaderboard Service
- [ ] Define API contracts
- [ ] Implement leaderboard generation
- [ ] Implement leaderboard filtering
- [ ] Implement real-time updates

#### API Gateway
- [ ] Define routing rules
- [ ] Implement authentication middleware
- [ ] Implement request validation
- [ ] Implement error handling

### Milestone 3: Frontend Implementation

- [ ] Set up React project with TypeScript
- [ ] Configure Tailwind CSS and Shadcn UI
- [ ] Implement routing with React Router
- [ ] Implement data fetching with React Query

#### Components
- [ ] Implement Header component
- [ ] Implement Navigation component
- [ ] Implement LeaderboardTable component
- [ ] Implement FilterBar component
- [ ] Implement MyStatsModal component

#### Pages
- [ ] Implement Session Leaderboard page
- [ ] Implement Country Leaderboard page
- [ ] Implement Global Leaderboard page
- [ ] Implement My Stats page

### Milestone 4: Integration and Testing

- [ ] Integrate frontend with backend services
- [ ] Implement end-to-end tests
- [ ] Perform load testing
- [ ] Fix bugs and optimize performance

### Milestone 5: Deployment and Documentation

#### General Deployment
- [ ] Deploy to staging environment
- [ ] Perform user acceptance testing
- [ ] Deploy to production environment
- [ ] Finalize documentation

#### Vercel Deployment for Frontend
- [ ] Set up Vercel project for the frontend application
- [ ] Configure environment variables in Vercel dashboard
- [ ] Connect GitHub repository to Vercel for automatic deployments
- [ ] Configure preview deployments for feature branches and PRs
- [ ] Set up custom domain and SSL certificate
- [ ] Configure deployment regions for optimal performance

#### Local Build Verification
- [ ] Implement local build verification script
- [ ] Document local build verification process
- [ ] Add pre-deployment checklist for developers
- [ ] Create build verification documentation

## Cross-Linked Documentation

The documentation for the Love Rank Pulse project is cross-linked to ensure traceability between requirements, tests, and implementation.

### Documentation Structure

- [ ] **Requirements**: Defined in the PRD and architecture plan
- [ ] **Implementation Plan**: This document
- [ ] **API Documentation**: Generated from code comments
- [ ] **Test Documentation**: Generated from test descriptions
- [ ] **User Documentation**: Created for end-users

### Cross-Linking Strategy

1. **Requirements to Tests**:
   - Each requirement has a unique ID
   - Tests reference requirement IDs in their descriptions
   - Example: `@requirement REQ-001`

2. **Tests to Implementation**:
   - Tests are organized to match the implementation structure
   - Test files are named to match implementation files
   - Example: `player.service.test.ts` for `player.service.ts`

3. **Implementation to Documentation**:
   - Code comments reference documentation sections
   - Documentation includes code examples
   - Example: `@see docs/api.md#player-service`

4. **Documentation to Requirements**:
   - Documentation references requirement IDs
   - Documentation includes traceability matrices
   - Example: `This API satisfies requirement REQ-001`

### Documentation Tools

- [ ] **JSDoc/TSDoc**: For code documentation
- [ ] **Swagger/OpenAPI**: For API documentation
- [ ] **Storybook**: For component documentation
- [ ] **Markdown**: For general documentation

## Vercel Deployment

Vercel is used as the deployment platform for the frontend application, providing continuous deployment, preview environments, and global CDN distribution.

### Vercel Setup and Configuration

- [ ] **Create Vercel Project**:
  - Sign up for a Vercel account
  - Create a new project in the Vercel dashboard
  - Import the GitHub repository
  - Configure the project settings

- [ ] **Environment Configuration**:
  - Set up environment variables in Vercel dashboard
  - Configure production, preview, and development environments
  - Set up environment-specific variables for API endpoints
  - Secure sensitive environment variables

- [ ] **GitHub Integration**:
  - Connect GitHub repository to Vercel
  - Configure automatic deployments for main branch
  - Set up preview deployments for pull requests
  - Configure GitHub status checks

- [ ] **Deployment Configuration**:
  - Configure build settings (`npm run build`)
  - Set output directory (`dist`)
  - Configure serverless functions if needed
  - Set up custom domains and SSL certificates

- [ ] **Monitoring and Analytics**:
  - Set up deployment notifications
  - Configure error monitoring
  - Set up performance analytics
  - Configure deployment logs

### Vercel Deployment Workflow

1. **Development**:
   - Develop features locally
   - Verify builds locally using the build verification process
   - Push changes to feature branch

2. **Preview Deployment**:
   - Create pull request to develop branch
   - Vercel automatically creates preview deployment
   - Review and test the preview deployment
   - Share preview URL with stakeholders for feedback

3. **Production Deployment**:
   - Merge pull request to main branch
   - Vercel automatically deploys to production
   - Verify production deployment
   - Monitor for any issues

### Vercel CLI Integration

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link local project to Vercel project
vercel link

# Deploy to preview environment
vercel

# Deploy to production
vercel --prod
```

## Local Build Verification

The local build verification process ensures that builds are tested and verified locally before being deployed to Vercel. This helps catch issues early in the development process and prevents broken builds from being deployed.

### Local Build Verification Process

- [ ] **Pre-build Checks**:
  - Ensure all tests pass locally
  - Verify code linting passes
  - Check for TypeScript compilation errors
  - Ensure all dependencies are correctly installed

- [ ] **Build Verification Steps**:
  - Run the build process locally: `npm run build`
  - Verify the build output structure
  - Check for any build warnings or errors
  - Validate asset optimization

- [ ] **Local Testing of Built Application**:
  - Serve the built application locally: `npm run preview`
  - Test critical user flows in the built application
  - Verify that all features work as expected
  - Check for any console errors or warnings

- [ ] **Pre-deployment Checklist**:
  - Confirm all build verification steps have passed
  - Document any build-specific considerations
  - Create a build verification report
  - Get approval from team lead if required

### Build Verification Scripts

```typescript
// scripts/verify-build.js
const fs = require('fs');
const path = require('path');

// Check if build directory exists
const buildDir = path.resolve(__dirname, '../dist');
if (!fs.existsSync(buildDir)) {
  console.error('Build directory does not exist');
  process.exit(1);
}

// Check for critical files
const requiredFiles = ['index.html', 'assets'];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(buildDir, file))) {
    console.error(`Required file/directory missing: ${file}`);
    process.exit(1);
  }
}

// Check bundle size
const assetDir = path.join(buildDir, 'assets');
const jsFiles = fs.readdirSync(assetDir).filter(file => file.endsWith('.js'));
for (const file of jsFiles) {
  const stats = fs.statSync(path.join(assetDir, file));
  const fileSizeInKB = stats.size / 1024;
  console.log(`${file}: ${fileSizeInKB.toFixed(2)} KB`);
  
  // Alert on large bundle sizes
  if (fileSizeInKB > 500) {
    console.warn(`Warning: ${file} is larger than 500KB`);
  }
}

console.log('Build verification completed successfully');
```

### Integration with CI/CD

The local build verification process is integrated with the CI/CD pipeline to ensure that all builds are verified before deployment:

1. Developers run verification locally before pushing changes
2. CI pipeline runs the same verification steps automatically
3. Build verification report is generated and attached to the build artifacts
4. Deployment to Vercel is only triggered if verification passes

## Appendices

### Appendix A: London School TDD Resources

- [Growing Object-Oriented Software, Guided by Tests](https://www.amazon.com/Growing-Object-Oriented-Software-Guided-Tests/dp/0321503627)
- [Outside-In TDD with Mockist TDD](https://www.pluralsight.com/courses/outside-in-tdd-mockist-london-school)

### Appendix B: Prisma Migration Commands

```bash
# Initialize Prisma
npx prisma init

# Generate migration
npx prisma migrate dev --name init

# Apply migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Appendix C: GitHub Actions Setup

```bash
# Create GitHub Actions workflow directory
mkdir -p .github/workflows

# Create CI workflow file
touch .github/workflows/ci.yml

# Create CD workflow file
touch .github/workflows/cd.yml
```

### Appendix D: Docker Setup

```bash
# Create Docker Compose file
touch docker-compose.yml

# Create Dockerfile for each service
touch Dockerfile
touch services/player/Dockerfile
touch services/match/Dockerfile
touch services/leaderboard/Dockerfile
touch services/gateway/Dockerfile
```

### Appendix E: Vercel Deployment Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Create Vercel configuration file
cat > vercel.json << EOF
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "API_URL": "https://api.loverankpulse.com"
  }
}
EOF

# Create build verification script
mkdir -p scripts
cat > scripts/verify-build.js << EOF
const fs = require('fs');
const path = require('path');

// Check if build directory exists
const buildDir = path.resolve(__dirname, '../dist');
if (!fs.existsSync(buildDir)) {
  console.error('Build directory does not exist');
  process.exit(1);
}

// Check for critical files
const requiredFiles = ['index.html', 'assets'];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(buildDir, file))) {
    console.error(\`Required file/directory missing: \${file}\`);
    process.exit(1);
  }
}

console.log('Build verification completed successfully');
EOF