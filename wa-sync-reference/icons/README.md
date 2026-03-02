# Icon Creation Instructions

## Current Status
The extension currently has an SVG icon (`icon128.svg`). Chrome extensions require PNG format icons.

## Quick Fix Options

### Option 1: Use Online Converter
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icons/icon128.svg`
3. Convert to PNG at these sizes: 16px, 32px, 48px, 128px
4. Save as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

### Option 2: Use ImageMagick (Command Line)
```bash
cd extension/icons

# Convert SVG to different PNG sizes
magick icon128.svg -resize 16x16 icon16.png
magick icon128.svg -resize 32x32 icon32.png
magick icon128.svg -resize 48x48 icon48.png
magick icon128.svg -resize 128x128 icon128.png
```

### Option 3: Use Inkscape (Command Line)
```bash
cd extension/icons

inkscape icon128.svg --export-type=png --export-filename=icon16.png -w 16 -h 16
inkscape icon128.svg --export-type=png --export-filename=icon32.png -w 32 -h 32
inkscape icon128.svg --export-type=png --export-filename=icon48.png -w 48 -h 48
inkscape icon128.svg --export-type=png --export-filename=icon128.png -w 128 -h 128
```

### Option 4: Use Node.js with Sharp
```bash
npm install sharp

# Create convert.js:
const sharp = require('sharp');

[16, 32, 48, 128].forEach(size => {
  sharp('icon128.svg')
    .resize(size, size)
    .png()
    .toFile(`icon${size}.png`);
});

# Run:
node convert.js
```

## Design Specifications

- **Base Color**: WhatsApp Green (#25D366)
- **Style**: WhatsApp logo on rounded square background
- **Format**: PNG with transparency
- **Sizes Required**: 16x16, 32x32, 48x48, 128x128

## Temporary Workaround

You can also use simple colored squares as placeholders:
- Create solid green squares in any image editor
- Add a simple "W" letter in white
- Export at required sizes

The current SVG can serve as a reference for the final design.
