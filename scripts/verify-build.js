#!/usr/bin/env node

/**
 * Build Verification Script
 * Validates build output and ensures all required files are present
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'dist');
const BUILD_MODE = process.env.BUILD_MODE || 'production';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Check if build directory exists
 */
function checkBuildDirectory() {
  if (!fs.existsSync(BUILD_DIR)) {
    error('Build directory does not exist!');
    return false;
  }
  success(`Build directory exists: ${BUILD_DIR}`);
  return true;
}

/**
 * Check for required files
 */
function checkRequiredFiles() {
  const requiredFiles = [
    'index.html',
  ];

  const requiredPatterns = [
    /^assets\/index-[a-zA-Z0-9]+\.js$/,  // Main JS bundle
    /^assets\/index-[a-zA-Z0-9]+\.css$/  // Main CSS bundle
  ];

  let allFilesPresent = true;

  // Check exact files
  for (const file of requiredFiles) {
    const filePath = path.join(BUILD_DIR, file);
    if (!fs.existsSync(filePath)) {
      error(`Required file missing: ${file}`);
      allFilesPresent = false;
    } else {
      success(`Found required file: ${file}`);
    }
  }

  // Check pattern-matched files
  const assetsDir = path.join(BUILD_DIR, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);

    for (const pattern of requiredPatterns) {
      const matchingFiles = assetFiles.filter(file => pattern.test(`assets/${file}`));
      if (matchingFiles.length === 0) {
        error(`No files matching pattern: ${pattern}`);
        allFilesPresent = false;
      } else {
        success(`Found file(s) matching pattern: ${pattern} (${matchingFiles[0]})`);
      }
    }
  } else {
    error('Assets directory does not exist!');
    allFilesPresent = false;
  }

  return allFilesPresent;
}

/**
 * Check index.html structure
 */
function checkIndexHtml() {
  const indexPath = path.join(BUILD_DIR, 'index.html');

  if (!fs.existsSync(indexPath)) {
    error('index.html not found');
    return false;
  }

  const content = fs.readFileSync(indexPath, 'utf8');

  const checks = [
    { pattern: /<html/i, name: 'HTML tag' },
    { pattern: /<head/i, name: 'HEAD tag' },
    { pattern: /<body/i, name: 'BODY tag' },
    { pattern: /<div id="root"/i, name: 'Root div' },
    { pattern: /type="module"/i, name: 'Module script' },
  ];

  let allChecksPass = true;

  for (const check of checks) {
    if (check.pattern.test(content)) {
      success(`index.html contains: ${check.name}`);
    } else {
      error(`index.html missing: ${check.name}`);
      allChecksPass = false;
    }
  }

  return allChecksPass;
}

/**
 * Analyze bundle sizes
 */
function analyzeBundleSizes() {
  const assetsDir = path.join(BUILD_DIR, 'assets');

  if (!fs.existsSync(assetsDir)) {
    warn('Assets directory not found for size analysis');
    return;
  }

  const files = fs.readdirSync(assetsDir);
  const maxSizes = {
    js: 500 * 1024,   // 500 KB for JS files
    css: 100 * 1024,  // 100 KB for CSS files
  };

  info('Analyzing bundle sizes...');

  let sizeWarnings = 0;

  for (const file of files) {
    const filePath = path.join(assetsDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    const ext = path.extname(file).substring(1);

    const message = `  ${file}: ${sizeKB} KB`;

    if (ext === 'js' && stats.size > maxSizes.js) {
      warn(`${message} (exceeds ${maxSizes.js / 1024} KB limit)`);
      sizeWarnings++;
    } else if (ext === 'css' && stats.size > maxSizes.css) {
      warn(`${message} (exceeds ${maxSizes.css / 1024} KB limit)`);
      sizeWarnings++;
    } else {
      info(message);
    }
  }

  if (sizeWarnings === 0) {
    success('All bundle sizes within acceptable limits');
  } else {
    warn(`${sizeWarnings} file(s) exceed recommended size limits`);
  }
}

/**
 * Check for source maps in production
 */
function checkSourceMaps() {
  if (BUILD_MODE !== 'production') {
    info('Skipping source map check (not production build)');
    return true;
  }

  const assetsDir = path.join(BUILD_DIR, 'assets');

  if (!fs.existsSync(assetsDir)) {
    return true;
  }

  const files = fs.readdirSync(assetsDir);
  const sourceMaps = files.filter(file => file.endsWith('.map'));

  if (sourceMaps.length > 0) {
    warn(`Found ${sourceMaps.length} source map(s) in production build`);
    sourceMaps.forEach(map => warn(`  - ${map}`));
    return false;
  } else {
    success('No source maps found in production build');
    return true;
  }
}

/**
 * Get total build size
 */
function getTotalBuildSize() {
  let totalSize = 0;

  function getDirectorySize(dirPath) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  }

  getDirectorySize(BUILD_DIR);

  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  info(`Total build size: ${sizeMB} MB`);

  return totalSize;
}

/**
 * Main verification function
 */
function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('  Build Verification Script', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

  info(`Build Mode: ${BUILD_MODE}`);
  info(`Build Directory: ${BUILD_DIR}\n`);

  const checks = [
    { name: 'Build Directory', fn: checkBuildDirectory },
    { name: 'Required Files', fn: checkRequiredFiles },
    { name: 'Index HTML', fn: checkIndexHtml },
    { name: 'Source Maps', fn: checkSourceMaps },
  ];

  let failedChecks = 0;

  for (const check of checks) {
    log(`\n--- ${check.name} ---`, 'yellow');
    const result = check.fn();
    if (!result) {
      failedChecks++;
    }
  }

  log('\n--- Bundle Analysis ---', 'yellow');
  analyzeBundleSizes();
  getTotalBuildSize();

  // Final summary
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');

  if (failedChecks === 0) {
    success('\n🎉 Build verification completed successfully!\n');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
    process.exit(0);
  } else {
    error(`\n❌ Build verification failed with ${failedChecks} error(s)!\n`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
    process.exit(1);
  }
}

// Run verification
main();
