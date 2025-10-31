import { defineConfig } from 'vite';

// Vite config tuned to reduce noisy reloads during editor temporary writes.
// Key points:
// - ignored: avoid watching node_modules, dist, .git, and editor folders
// - awaitWriteFinish: wait until the file write stabilizes before triggering reload
// This makes the dev server react on actual saves (and avoids intermediate temp-file events).
export default defineConfig({
  // Use relative base so built files can be hosted from GitHub Pages
  // (project pages or gh-pages branch). Relative base avoids hardcoding
  // the repository name and works when files are served from the repo root.
  base: './',
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
});
