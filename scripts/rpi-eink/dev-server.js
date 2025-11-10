#!/usr/bin/env node
/**
 * dev-server.js
 * Simple development server to preview render-to-image output in browser
 * 
 * Usage: node scripts/rpi-eink/dev-server.js [port]
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { renderToImage } = require('./render-to-image.js');

const PORT = parseInt(process.argv[2] || '3001', 10);
const OUTPUT_PATH = path.join(__dirname, 'preview.png');

async function generateImage() {
  try {
    await renderToImage(OUTPUT_PATH, 960, 640);
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to generate image:', error.message);
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/') {
    // Serve HTML viewer
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trainboard Preview - Development Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1a1a1a;
      color: #fff;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
    }
    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    button {
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    button:hover { background: #0056b3; }
    button:disabled { background: #666; cursor: not-allowed; }
    .auto-refresh {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
    }
    .status.success { background: #28a745; }
    .status.error { background: #dc3545; }
    .status.loading { background: #ffc107; color: #000; }
    .preview-container {
      border: 2px solid #333;
      border-radius: 8px;
      overflow: hidden;
      background: white;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    img {
      display: block;
      max-width: 100%;
      height: auto;
    }
    .info {
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <h1>🚆 Trainboard E-Ink Preview</h1>
  
  <div class="controls">
    <button onclick="refresh()">Refresh Now</button>
    <div class="auto-refresh">
      <input type="checkbox" id="autoRefresh" onchange="toggleAutoRefresh(this.checked)">
      <label for="autoRefresh">Auto-refresh every 30s</label>
    </div>
    <span id="status" class="status"></span>
  </div>

  <div class="preview-container">
    <img id="preview" src="/image?t=${Date.now()}" alt="Trainboard preview">
  </div>

  <div class="info">
    Last updated: <span id="timestamp">${new Date().toLocaleString('ja-JP')}</span>
  </div>

  <script>
    let autoRefreshInterval = null;

    async function refresh() {
      const statusEl = document.getElementById('status');
      const imgEl = document.getElementById('preview');
      const timestampEl = document.getElementById('timestamp');
      
      statusEl.textContent = 'Generating...';
      statusEl.className = 'status loading';
      
      try {
        const response = await fetch('/refresh');
        const result = await response.json();
        
        if (result.success) {
          imgEl.src = '/image?t=' + Date.now();
          statusEl.textContent = 'Updated!';
          statusEl.className = 'status success';
          timestampEl.textContent = new Date().toLocaleString('ja-JP');
          setTimeout(() => { statusEl.textContent = ''; }, 2000);
        } else {
          statusEl.textContent = 'Error: ' + (result.error || 'Unknown error');
          statusEl.className = 'status error';
        }
      } catch (error) {
        statusEl.textContent = 'Network error';
        statusEl.className = 'status error';
      }
    }

    function toggleAutoRefresh(enabled) {
      if (enabled) {
        autoRefreshInterval = setInterval(refresh, 30000);
      } else {
        if (autoRefreshInterval) {
          clearInterval(autoRefreshInterval);
          autoRefreshInterval = null;
        }
      }
    }
  </script>
</body>
</html>
    `);
  } else if (url.pathname === '/refresh') {
    // Regenerate image
    const success = await generateImage();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success }));
  } else if (url.pathname === '/image') {
    // Serve the generated image
    if (fs.existsSync(OUTPUT_PATH)) {
      const img = fs.readFileSync(OUTPUT_PATH);
      res.writeHead(200, { 
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache'
      });
      res.end(img);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Image not found. Click refresh to generate.');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

// Generate initial image
generateImage().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚆 Trainboard Development Server`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`\n  Preview the render-to-image output in your browser`);
    console.log(`  Click "Refresh" to regenerate the image\n`);
  });
});
