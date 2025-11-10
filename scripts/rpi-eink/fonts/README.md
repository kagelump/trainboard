# E-Ink Optimized Fonts

This directory contains fonts optimized for e-ink displays.

## Quick Setup

```bash
# From project root:
node scripts/rpi-eink/fonts/setup-fonts.js
```

This will download **Noto Sans JP** (recommended for Japanese content).

## Installed Fonts

After running setup, you'll have:

- `NotoSansJP-Regular.ttf` - Variable font with all weights (Regular → Bold)
- `NotoSansJP-Bold.ttf` - Symlink to variable font

## Why Noto Sans JP?

✅ **Excellent for e-ink**: Clear strokes, good weight, high contrast
✅ **Japanese support**: Full coverage of Kanji, Hiragana, Katakana
✅ **Designed by Google**: Optimized for screen readability
✅ **Variable font**: One file contains all weights (saves space)

## Alternative Fonts

### For More Comprehensive CJK

If you need broader Chinese/Japanese/Korean coverage:

```bash
# Download manually from:
https://github.com/notofonts/noto-cjk/releases

# Extract and place in this directory:
# - NotoSansCJKjp-Regular.otf
# - NotoSansCJKjp-Bold.otf
```

The renderer will automatically detect and use these instead.

### For Latin-Only Content

If your content is primarily English/Latin characters, try:

**Merriweather** (Serif - High readability)

- Download: https://fonts.google.com/specimen/Merriweather
- Best for: Long text, body content
- E-ink quality: Excellent

**Bitter** (Slab Serif - Strong contrast)

- Download: https://fonts.google.com/specimen/Bitter
- Best for: Headers, short text
- E-ink quality: Excellent

**Open Sans** (Sans-serif - Clean)

- Download: https://fonts.google.com/specimen/Open+Sans
- Best for: Modern, minimal look
- E-ink quality: Very good

**Literata** (Google Play Books)

- Download: https://fonts.google.com/specimen/Literata
- Best for: Digital reading
- E-ink quality: Excellent

To use these, download the TTF files and place them in this directory, then update the font registration code in `render-to-image.js`.

## Manual Installation

1. Download font files (.ttf or .otf)
2. Place them in this directory: `/Users/.../scripts/rpi-eink/fonts/`
3. The renderer auto-detects: Noto Sans JP → Noto Sans CJK JP → System fonts

## Font Testing

```bash
# Test rendering with fonts
node scripts/rpi-eink/render-to-image.js test.png

# View in browser
npm run eink:preview
# Visit http://localhost:3002
```

Look for these log messages:

```
[INFO] Registered font: Noto Sans JP Regular
[INFO] Registered font: Noto Sans JP Bold
```

## E-Ink Font Requirements

Good e-ink fonts have:

- **Medium weight**: Not too thin, not too thick
- **Clear strokes**: Distinct letterforms
- **Good spacing**: Letters don't blend together
- **High contrast**: Strong difference between thick/thin strokes

## Troubleshooting

**Fonts not loading?**

1. Check files exist:

   ```bash
   ls -lh scripts/rpi-eink/fonts/
   ```

2. Re-run setup:

   ```bash
   node scripts/rpi-eink/fonts/setup-fonts.js
   ```

3. Check console output for registration messages

**Still using system fonts?**

The renderer gracefully falls back to system fonts if custom fonts aren't available. This is normal during development.

## More Info

See `../FONTS.md` for detailed documentation about:

- How font registration works
- Performance considerations
- Adding custom fonts
- Font usage in the codebase
