# E-Ink Preview Development Tools

Three ways to preview the `render-to-image.js` output during development:

## Option 1: Standalone Dev Server (Recommended)

Start a dedicated preview server:

```bash
npm run eink:preview
```

Then open http://localhost:3001 in your browser.

**Features:**

- Live preview of the generated PNG
- Manual refresh button to regenerate image
- Auto-refresh option (every 30 seconds)
- Uses actual API data and renders exactly like production

**Good for:** Quick iteration on render-to-image.js logic

---

## Option 2: Vite Plugin Integration

Add the preview to your main Vite dev server.

1. Add to `vite.config.ts`:

```typescript
import einkPreview from './scripts/rpi-eink/vite-plugin-eink-preview.js';

export default defineConfig({
  plugins: [einkPreview()],
  // ... other config
});
```

2. Run your normal dev server:

```bash
npm run dev
```

3. Visit http://localhost:5173/eink-preview

**Features:**

- Integrated with main development workflow
- Same port as your main app
- Refresh button to regenerate

**Good for:** Working on both web UI and e-ink render simultaneously

---

## Option 3: Browser Canvas Preview

Open `scripts/rpi-eink/preview.html` directly in your browser (via a local server):

```bash
# From project root
npx serve scripts/rpi-eink
# Then open http://localhost:3000/preview.html
```

**Features:**

- Pure client-side rendering using HTML Canvas
- No server-side generation needed
- Download rendered canvas as PNG
- Toggle dark/light theme

**Good for:**

- Quick visual testing without API calls
- Testing layout and styling changes
- Comparing browser canvas vs server-side node-canvas rendering

**Note:** Font rendering may differ slightly from server-side due to browser vs node-canvas differences.

---

## Development Workflow

### For E-Ink Layout Changes:

1. Start preview server: `npm run eink:preview`
2. Edit `render-to-image.js`
3. Click "Refresh" in browser
4. Iterate

### For Testing with Real Data:

1. Ensure `defaults.json` has your test station configured
2. Run preview server
3. Check console logs for API responses
4. Verify station names are in Japanese

### For Production Testing:

1. Run the script directly:
   ```bash
   node scripts/rpi-eink/render-to-image.js output.png 960 640
   ```
2. Check the generated PNG file

---

## Tips

- **Performance**: The dev server caches renders, so subsequent refreshes are faster
- **API Rate Limits**: Auto-refresh is set to 30s to avoid hitting API rate limits
- **Fonts**: Server-side rendering uses system fonts. Install Japanese fonts for best results:
  ```bash
  # macOS - usually already has Japanese fonts
  # Linux:
  sudo apt-get install fonts-noto-cjk
  ```
- **Canvas Size**: Default is 960x640 (Waveshare 7.5" e-ink display). Adjust in code if needed.

---

## Files

- `dev-server.js` - Standalone HTTP server for preview (Option 1)
- `vite-plugin-eink-preview.js` - Vite plugin integration (Option 2)
- `preview.html` - Browser-based canvas preview (Option 3)
- `render-to-image.js` - Main server-side rendering script
