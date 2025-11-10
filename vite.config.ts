import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve } from 'path';

// Vite config tuned to reduce noisy reloads during editor temporary writes.
// Key points:
// - ignored: avoid watching node_modules, dist, .git, and editor folders
// - awaitWriteFinish: wait until the file write stabilizes before triggering reload
// This makes the dev server react on actual saves (and avoids intermediate temp-file events).
export default defineConfig({
  // Top-level base used by Vite to generate absolute/relative asset URLs.
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.vscode/**'],
      // Wait for the file write to finish. Tune stabilityThreshold (ms) if needed.
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
  define: {
    // Make the base path available at runtime
    __APP_BASE_PATH__: JSON.stringify(process.env.VITE_BASE_PATH || '/'),
  },
  plugins: [
    {
      name: 'generate-404',
      closeBundle() {
        // Generate 404.html from dist/index.html for GitHub Pages SPA routing
        const indexPath = resolve(__dirname, 'dist/index.html');
        const notFoundPath = resolve(__dirname, 'dist/404.html');
        try {
          const indexContent = readFileSync(indexPath, 'utf-8');
          writeFileSync(notFoundPath, indexContent);
          console.log('Generated 404.html from index.html for GitHub Pages SPA routing');
        } catch (error) {
          console.warn('Failed to generate 404.html:', error);
        }

        // Copy rpi_setup.sh to dist for GitHub Pages deployment
        // This allows users to run: curl https://trainboard.hinoka.org/rpi_setup.sh | sudo sh
        const setupScriptPath = resolve(__dirname, 'rpi_setup.sh');
        const setupScriptDestPath = resolve(__dirname, 'dist/rpi_setup.sh');
        try {
          copyFileSync(setupScriptPath, setupScriptDestPath);
          console.log('Copied rpi_setup.sh to dist/ for deployment');
        } catch (error) {
          console.warn('Failed to copy rpi_setup.sh:', error);
        }
      },
    },
  ],
});
