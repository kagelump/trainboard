#!/usr/bin/env node
/**
 * render-to-image.js
 * Wrapper script that runs the TypeScript version of render-to-image
 * This maintains backwards compatibility while using the TypeScript implementation
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const tsFile = path.join(__dirname, 'render-to-image.ts');
const args = process.argv.slice(2);

// Check if tsx is available
let tsxPath;
try {
  tsxPath = require.resolve('tsx/cli');
} catch (e) {
  // tsx not found, try npx
  try {
    execFileSync('npx', ['--version'], { stdio: 'ignore' });
    // Run with npx tsx
    const result = execFileSync('npx', ['tsx', tsFile, ...args], {
      stdio: 'inherit',
      cwd: __dirname,
    });
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] tsx not found. Please install with: npm install tsx');
    console.error('[ERROR] Or run directly with: npx tsx scripts/rpi-eink/render-to-image.ts');
    process.exit(1);
  }
}

// Run with tsx
try {
  execFileSync('node', [tsxPath, tsFile, ...args], {
    stdio: 'inherit',
    cwd: __dirname,
  });
  process.exit(0);
} catch (err) {
  process.exit(err.status || 1);
}
