# Font System for E-Ink Trainboard

## Overview

The trainboard renderer now supports custom fonts optimized for e-ink displays. The system automatically detects and loads custom fonts if available, falling back to system fonts if not.

## Quick Start

### Install Fonts

```bash
node scripts/rpi-eink/fonts/setup-fonts.js
```

This downloads **Noto Sans JP** (a variable weight font that includes Regular, Bold, and all weights in between) from Google Fonts.

### Test the Fonts

```bash
# Render with custom fonts
node scripts/rpi-eink/render-to-image.js trainboard.png

# Start preview server
npm run eink:preview
# Visit http://localhost:3002
```

## Font Selection

### Current: Noto Sans JP ✅

- **Why**: Designed by Google for excellent screen readability
- **Japanese Support**: Full Japanese character coverage (Kanji, Hiragana, Katakana)
- **E-ink Optimized**: Clear strokes, good weight, high contrast
- **Variable Font**: Single file contains all weights (Regular → Bold)
- **File Size**: ~9MB (variable font with all weights)

### Alternative Fonts

You can manually install other fonts in `scripts/rpi-eink/fonts/`:

#### Noto Sans CJK JP (Full CJK)

- More comprehensive CJK coverage
- Larger file size (~40MB per weight)
- Download: https://github.com/notofonts/noto-cjk/releases
- Files: `NotoSansCJKjp-Regular.otf`, `NotoSansCJKjp-Bold.otf`

#### Merriweather (Latin-focused)

- Excellent for English text on e-ink
- Tall x-height, high contrast serifs
- Download: https://fonts.google.com/specimen/Merriweather
- Files: `Merriweather-Regular.ttf`, `Merriweather-Bold.ttf`

#### Bitter (Slab Serif)

- Strong, robust letterforms
- Good for low-resolution displays
- Download: https://fonts.google.com/specimen/Bitter

#### Open Sans (Sans-serif)

- Wider characters, open shapes
- Very readable on screens
- Download: https://fonts.google.com/specimen/Open+Sans

## How It Works

### Automatic Font Detection

The renderer checks for fonts in this order:

1. **Noto Sans JP** (`NotoSansJP-Regular.ttf`, `NotoSansJP-Bold.ttf`)
2. **Noto Sans CJK JP** (`NotoSansCJKjp-Regular.otf`, `NotoSansCJKjp-Bold.otf`)
3. **System fonts** (fallback: `sans-serif`, `monospace`)

### Font Registration

```javascript
// In render-to-image.js
const { registerFont } = require('canvas');

registerFont('fonts/NotoSansJP-Regular.ttf', {
  family: 'Noto Sans JP',
});

registerFont('fonts/NotoSansJP-Bold.ttf', {
  family: 'Noto Sans JP',
  weight: 'bold',
});
```

### Font Usage

```javascript
// Regular text
ctx.font = '20px Noto Sans JP';

// Bold text
ctx.font = 'bold 32px Noto Sans JP';

// Monospace (for times)
ctx.font = 'bold 36px monospace'; // Still uses system monospace
```

## Font Styles in Trainboard

| Element         | Font         | Size | Weight  |
| --------------- | ------------ | ---- | ------- |
| Station Name    | Noto Sans JP | 32px | Bold    |
| Railway Name    | Noto Sans JP | 20px | Regular |
| Current Time    | monospace    | 36px | Bold    |
| Direction Title | Noto Sans JP | 28px | Bold    |
| Departure Time  | monospace    | 32px | Bold    |
| Train Type      | Noto Sans JP | 20px | Bold    |
| Destination     | Noto Sans JP | 20px | Regular |
| No Data Message | Noto Sans JP | 24px | Regular |

## Manual Font Installation

1. **Download font files** (.ttf or .otf)
2. **Place in** `scripts/rpi-eink/fonts/`
3. **Update** `render-to-image.js` if needed:

```javascript
// Add to registerFonts() function
registerFont(path.join(fontsDir, 'YourFont-Regular.ttf'), {
  family: 'Your Font Name',
});
```

4. **Update** font name in code:

```javascript
function getFontName(useCustomFonts) {
  return useCustomFonts ? 'Your Font Name' : 'sans-serif';
}
```

## Troubleshooting

### Fonts not loading?

Check the console output when running the script:

```
[INFO] Registered font: Noto Sans JP Regular
[INFO] Registered font: Noto Sans JP Bold
```

If you see warnings instead:

```
[WARN] Failed to register fonts: ...
[WARN] Run: node scripts/rpi-eink/fonts/setup-fonts.js
```

### Still seeing system fonts?

1. Verify font files exist:

   ```bash
   ls -lh scripts/rpi-eink/fonts/
   ```

2. Check font file permissions:

   ```bash
   chmod 644 scripts/rpi-eink/fonts/*.ttf
   ```

3. Test font registration:
   ```bash
   node -e "const {registerFont} = require('canvas'); registerFont('scripts/rpi-eink/fonts/NotoSansJP-Regular.ttf', {family: 'Test'}); console.log('OK');"
   ```

### Japanese characters not rendering?

Make sure you're using a font with CJK (Chinese, Japanese, Korean) support:

- ✅ Noto Sans JP (included)
- ✅ Noto Sans CJK JP
- ❌ Merriweather (Latin only)
- ❌ Bitter (Latin only)

## Performance Notes

### File Size Impact

| Font                    | File Size           | Load Time | Memory |
| ----------------------- | ------------------- | --------- | ------ |
| Noto Sans JP (variable) | 9MB                 | ~50ms     | ~10MB  |
| Noto Sans CJK JP        | 80MB (both weights) | ~200ms    | ~40MB  |
| System fonts            | 0                   | 0ms       | 0MB    |

### Recommendations

- **Raspberry Pi**: Use Noto Sans JP (good balance)
- **Development**: System fonts are fine (faster iteration)
- **Production**: Custom fonts for best e-ink quality

## E-Ink Font Best Practices

1. **Weight**: Use medium-weight fonts (not too thin, not too thick)
2. **Spacing**: Fonts with good letter spacing work better
3. **Serifs**: Slab serifs or sans-serif work best
4. **Size**: 18px minimum for readability
5. **Contrast**: High-contrast fonts are clearer on e-ink

## Resources

- [Noto Fonts Project](https://fonts.google.com/noto)
- [Google Fonts](https://fonts.google.com/)
- [node-canvas Font Documentation](https://github.com/Automattic/node-canvas#registerfont)
- [E-Ink Typography Best Practices](https://ebookfriendly.com/best-fonts-for-reading-on-kindle/)
