#!/usr/bin/env node

/**
 * Downloads Noto Sans CJK JP fonts for Japanese train board rendering
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = __dirname;
const RELEASE_URL =
  'https://github.com/notofonts/noto-cjk/releases/download/Sans2.004/04_NotoSansCJKjp.zip';
const ZIP_FILE = path.join(FONTS_DIR, 'NotoSansCJKjp.zip');

console.log('📥 Downloading Noto Sans CJK JP fonts...');
console.log('This may take a moment (large file ~40MB)');

// Download the zip file
const file = fs.createWriteStream(ZIP_FILE);
https
  .get(RELEASE_URL, (response) => {
    if (response.statusCode !== 200) {
      console.error(`❌ Failed to download: HTTP ${response.statusCode}`);
      process.exit(1);
    }

    const totalBytes = parseInt(response.headers['content-length'], 10);
    let downloadedBytes = 0;

    response.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
      process.stdout.write(`\r⏳ Progress: ${percent}%`);
    });

    response.pipe(file);

    file.on('finish', () => {
      file.close();
      console.log('\n✅ Download complete!');
      console.log('\n📦 Next steps:');
      console.log('1. Unzip the downloaded file:');
      console.log(`   cd ${FONTS_DIR}`);
      console.log(`   unzip NotoSansCJKjp.zip`);
      console.log('2. Move the fonts to this directory:');
      console.log('   mv NotoSansCJKjp-Regular.otf .');
      console.log('   mv NotoSansCJKjp-Bold.otf .');
      console.log('3. Clean up:');
      console.log('   rm NotoSansCJKjp.zip');
      console.log('\n💡 Or use the automated setup script:');
      console.log('   node scripts/rpi-eink/fonts/setup-fonts.js');
    });
  })
  .on('error', (err) => {
    fs.unlink(ZIP_FILE, () => {});
    console.error(`\n❌ Download failed: ${err.message}`);
    process.exit(1);
  });
