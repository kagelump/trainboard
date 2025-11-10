#!/usr/bin/env node
/**
 * vite-plugin-eink-preview.js
 * Vite plugin to preview render-to-image output during development
 *
 * Add to vite.config.ts:
 * import einkPreview from './scripts/rpi-eink/vite-plugin-eink-preview.js';
 *
 * plugins: [einkPreview()]
 */

const path = require('path');
const fs = require('fs');

function einkPreviewPlugin() {
  const OUTPUT_PATH = path.join(__dirname, 'preview.png');
  let renderToImage;

  return {
    name: 'vite-plugin-eink-preview',

    async configureServer(server) {
      // Lazy load the render function
      const renderModule = await import('./render-to-image.js');
      renderToImage = renderModule.renderToImage;

      // Generate initial preview
      try {
        await renderToImage(OUTPUT_PATH, 960, 640);
        console.log('[eink-preview] Initial preview generated');
      } catch (error) {
        console.error('[eink-preview] Failed to generate initial preview:', error.message);
      }

      // Add custom routes
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/eink-preview') {
          // Serve preview viewer HTML
          res.setHeader('Content-Type', 'text/html');
          res.end(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-Ink Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0a0a;
      color: #fff;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    h1 { font-size: 20px; font-weight: 600; }
    button {
      background: #0070f3;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover { background: #0051cc; }
    .preview {
      border: 1px solid #333;
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }
    img { display: block; max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>E-Ink Render Preview</h1>
  <button onclick="refresh()">Refresh</button>
  <div class="preview">
    <img id="img" src="/eink-preview/image?t=${Date.now()}" alt="Preview">
  </div>
  <script>
    async function refresh() {
      await fetch('/eink-preview/refresh');
      document.getElementById('img').src = '/eink-preview/image?t=' + Date.now();
    }
  </script>
</body>
</html>
          `);
          return;
        }

        if (req.url === '/eink-preview/refresh') {
          // Regenerate image
          try {
            await renderToImage(OUTPUT_PATH, 960, 640);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
          return;
        }

        if (req.url?.startsWith('/eink-preview/image')) {
          // Serve the image
          if (fs.existsSync(OUTPUT_PATH)) {
            const img = fs.readFileSync(OUTPUT_PATH);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(img);
          } else {
            res.statusCode = 404;
            res.end('Image not found');
          }
          return;
        }

        next();
      });
    },
  };
}

module.exports = einkPreviewPlugin;
