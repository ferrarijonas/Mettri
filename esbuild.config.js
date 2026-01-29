import * as esbuild from 'esbuild';
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

const isWatch = process.argv.includes('--watch');

// Ensure directories exist
if (!existsSync('dist')) {
  mkdirSync('dist');
}
if (!existsSync('dist/icons')) {
  mkdirSync('dist/icons');
}

// Copy static files
const staticFiles = ['manifest.json'];
for (const file of staticFiles) {
  if (existsSync(file)) {
    copyFileSync(file, `dist/${file}`);
  }
}

// Copy icons
if (existsSync('assets/icons')) {
  const icons = readdirSync('assets/icons');
  for (const icon of icons) {
    copyFileSync(path.join('assets/icons', icon), path.join('dist/icons', icon));
  }
}

// Process CSS with PostCSS (Tailwind)
async function processCSS(inputPath, outputPath) {
  if (!existsSync(inputPath)) {
    console.warn(`CSS file not found: ${inputPath}`);
    return;
  }

  const css = readFileSync(inputPath, 'utf-8');
  try {
    const result = await postcss([tailwindcss, autoprefixer])
      .process(css, { from: inputPath, to: outputPath });
    writeFileSync(outputPath, result.css);
    console.log(`✓ Processed CSS: ${inputPath} → ${outputPath}`);
  } catch (error) {
    console.error(`Error processing CSS: ${error.message}`);
    // Fallback: copy original file
    copyFileSync(inputPath, outputPath);
  }
}

// Process Tailwind CSS
if (existsSync('src/ui/tailwind-input.css')) {
  await processCSS('src/ui/tailwind-input.css', 'dist/panel.css');
} else if (existsSync('src/ui/panel.css')) {
  // Fallback: copy existing CSS if tailwind-input.css doesn't exist
  copyFileSync('src/ui/panel.css', 'dist/panel.css');
}

// Copy themes
if (existsSync('src/ui/theme/themes')) {
  if (!existsSync('dist/themes')) {
    mkdirSync('dist/themes');
  }
  const themeFiles = readdirSync('src/ui/theme/themes');
  for (const theme of themeFiles) {
    if (theme.endsWith('.css')) {
      copyFileSync(
        path.join('src/ui/theme/themes', theme),
        path.join('dist/themes', theme)
      );
    }
  }
}

// Build configuration
const buildOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  target: ['chrome100'],
  format: 'iife',
};

// Content script
const contentBuild = {
  ...buildOptions,
  entryPoints: ['src/content/main.ts'],
  outfile: 'dist/content.js',
};

// Background service worker
const backgroundBuild = {
  ...buildOptions,
  entryPoints: ['src/background/service-worker.ts'],
  outfile: 'dist/background.js',
};

async function build() {
  try {
    // Process CSS first (before building JS)
    if (existsSync('src/ui/tailwind-input.css')) {
      await processCSS('src/ui/tailwind-input.css', 'dist/panel.css');
    } else if (existsSync('src/ui/panel.css')) {
      copyFileSync('src/ui/panel.css', 'dist/panel.css');
    }

    if (isWatch) {
      const contentCtx = await esbuild.context(contentBuild);
      const backgroundCtx = await esbuild.context(backgroundBuild);

      await Promise.all([contentCtx.watch(), backgroundCtx.watch()]);

      console.log('Watching for changes...');
    } else {
      await Promise.all([
        esbuild.build(contentBuild),
        esbuild.build(backgroundBuild)
      ]);

      console.log('Build completed successfully!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
