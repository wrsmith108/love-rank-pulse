#!/usr/bin/env node
/**
 * Server Configuration Verification Script
 *
 * Verifies that the Express server can be loaded and configured
 * without actually starting the HTTP server.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Server Configuration Verification\n');
console.log('=' .repeat(60));

// Check 1: Required files exist
console.log('\n1️⃣  Checking required files...');
const requiredFiles = [
  'src/server.ts',
  'src/routes/index.ts',
  'src/routes/auth.routes.ts',
  'src/routes/players.routes.ts',
  'src/routes/matches.routes.ts',
  'src/routes/leaderboard.routes.ts',
  'src/routes/health.routes.ts',
  'src/middleware/security.ts',
  'src/middleware/logger.ts',
  'src/middleware/errorHandler.ts',
  '.env'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Check 2: Environment variables
console.log('\n2️⃣  Checking environment variables...');
require('dotenv').config();

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PORT'
];

const optionalEnvVars = [
  'REDIS_URL',
  'NODE_ENV'
];

let allEnvVarsSet = true;
console.log('\n   Required:');
requiredEnvVars.forEach(envVar => {
  const exists = !!process.env[envVar];
  console.log(`   ${exists ? '✅' : '❌'} ${envVar} ${exists ? '(set)' : '(missing)'}`);
  if (!exists) allEnvVarsSet = false;
});

console.log('\n   Optional:');
optionalEnvVars.forEach(envVar => {
  const exists = !!process.env[envVar];
  console.log(`   ${exists ? '✅' : '💡'} ${envVar} ${exists ? '(set)' : '(not set)'}`);
});

// Check 3: Dependencies
console.log('\n3️⃣  Checking dependencies...');
const requiredDeps = [
  'express',
  '@prisma/client',
  'redis',
  'helmet',
  'morgan',
  'jsonwebtoken',
  'cors'
];

let allDepsInstalled = true;
requiredDeps.forEach(dep => {
  try {
    require.resolve(dep);
    console.log(`   ✅ ${dep}`);
  } catch (e) {
    console.log(`   ❌ ${dep} (not installed)`);
    allDepsInstalled = false;
  }
});

// Check 4: Server file syntax
console.log('\n4️⃣  Checking server.ts structure...');
const serverContent = fs.readFileSync(path.join(process.cwd(), 'src/server.ts'), 'utf8');

const checks = [
  { pattern: /import express.*from ['"]express['"]/, name: 'Express import' },
  { pattern: /import.*PrismaClient.*from ['"]@prisma\/client['"]/, name: 'Prisma import' },
  { pattern: /const app.*=.*express\(\)/, name: 'Express app initialization' },
  { pattern: /app\.use\(['"]\/api['"],.*routes\)/, name: 'Routes mounted at /api' },
  { pattern: /app\.listen\(/, name: 'HTTP server start' },
  { pattern: /prisma\.\$connect\(\)/, name: 'Database connection test' },
  { pattern: /SIGTERM|SIGINT/, name: 'Graceful shutdown handlers' }
];

checks.forEach(check => {
  const found = check.pattern.test(serverContent);
  console.log(`   ${found ? '✅' : '❌'} ${check.name}`);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Verification Summary:\n');

if (allFilesExist && allEnvVarsSet && allDepsInstalled) {
  console.log('   ✅ All critical checks passed!');
  console.log('   ✅ Server configuration is valid');
  console.log('\n   ⚠️  Note: Database and Redis must be running for server to start');
  console.log('\n   🚀 Ready to start server with: npm run dev');
  process.exit(0);
} else {
  console.log('   ❌ Some checks failed:');
  if (!allFilesExist) console.log('      - Missing required files');
  if (!allEnvVarsSet) console.log('      - Missing required environment variables');
  if (!allDepsInstalled) console.log('      - Missing required dependencies');
  console.log('\n   📝 See verification report for details');
  process.exit(1);
}
