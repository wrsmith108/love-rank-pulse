// This script is used by Vercel to build the application
// It ensures that the build process is consistent between local development and Vercel deployment

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log the Node.js version
console.log(`Node.js version: ${process.version}`);
console.log(`Working directory: ${process.cwd()}`);

// Check if the dist directory exists and create it if it doesn't
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('Created dist directory');
}

try {
  // Run the build command
  console.log('Building the application...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed successfully');

  // Verify the build output
  const files = fs.readdirSync(distDir);
  console.log(`Build output files: ${files.join(', ')}`);

  // Create a _redirects file for SPA routing
  const redirectsPath = path.join(distDir, '_redirects');
  fs.writeFileSync(redirectsPath, '/* /index.html 200');
  console.log('Created _redirects file for SPA routing');

  // Create a robots.txt file if it doesn't exist
  const robotsPath = path.join(distDir, 'robots.txt');
  if (!fs.existsSync(robotsPath)) {
    fs.writeFileSync(robotsPath, 'User-agent: *\nAllow: /');
    console.log('Created robots.txt file');
  }

  console.log('Vercel build script completed successfully');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}