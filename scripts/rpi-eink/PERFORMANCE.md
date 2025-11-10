# Direct Rendering Performance Comparison

## Chromium-based Rendering (Old Method)
- **Time**: 20-30 seconds per update
- **Memory**: ~500MB+ (Chromium + Xvfb)
- **Dependencies**: chromium-browser, xvfb, puppeteer (optional)
- **CPU Usage**: High during rendering

## Node.js Canvas Direct Rendering (New Method)
- **Time**: 2-3 seconds per update (~10x faster)
- **Memory**: ~50MB (Node.js + Canvas)
- **Dependencies**: Node.js, canvas npm package
- **CPU Usage**: Low to moderate

## Why This Matters on Raspberry Pi

The Raspberry Pi Zero 2 W has:
- 512MB RAM
- Quad-core ARM Cortex-A53 @ 1GHz

Running Chromium on this hardware is resource-intensive and slow. The direct rendering approach:
1. Eliminates browser overhead
2. Reduces memory pressure
3. Allows more frequent updates
4. Extends the life of the SD card (less swapping)

## Fallback Strategy

The update script intelligently chooses the best method:

1. **Try direct rendering first** (render-to-image.js)
2. **If that fails**, fall back to Puppeteer with Chromium
3. **If that fails**, use Chromium + Xvfb

This ensures maximum compatibility while preferring the fastest method.
