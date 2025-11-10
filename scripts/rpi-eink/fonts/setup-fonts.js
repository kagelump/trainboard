#!/usr/bin/env node

/**
 * Automated font setup script
 * Downloads Noto Sans JP from Google Fonts (easier than CJK package)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = __dirname;

console.log('🚀 Setting up fonts for trainboard e-ink display...\n');

// Check if fonts already exist
const regularFont = path.join(FONTS_DIR, 'NotoSansJP-Regular.ttf');
const boldFont = path.join(FONTS_DIR, 'NotoSansJP-Bold.ttf');

if (fs.existsSync(regularFont) && fs.existsSync(boldFont)) {
  console.log('✅ Fonts already installed!');
  console.log(`   Regular: ${regularFont}`);
  console.log(`   Bold: ${boldFont}`);
  process.exit(0);
}

console.log('📥 Downloading Noto Sans JP from Google Fonts...\n');

try {
  // Download directly from Google Fonts CDN
  const regularUrl =
    'https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf';

  console.log('   Downloading Noto Sans JP (Variable font)...');
  execSync(
    `curl -L -o "${regularFont}" "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"`,
    { stdio: 'inherit' },
  );

  // Create a symlink for "bold" that points to the same variable font
  // Variable fonts contain all weights, so we can use the same file
  fs.symlinkSync('NotoSansJP-Regular.ttf', boldFont);

  console.log('\n✅ Font setup complete!');
  console.log(`   Font: ${regularFont} (variable weight)`);
  console.log('\n💡 This variable font includes all weights (Regular, Bold, etc.)');
  console.log('   Fonts will be automatically loaded by render-to-image.js');
} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  console.log('\n📝 Alternative: Download manually');
  console.log('1. Visit: https://fonts.google.com/noto/specimen/Noto+Sans+JP');
  console.log('2. Click "Download family"');
  console.log('3. Extract NotoSansJP-Regular.ttf and NotoSansJP-Bold.ttf (or any .ttf files)');
  console.log(`4. Place them in: ${FONTS_DIR}`);
  process.exit(1);
}
