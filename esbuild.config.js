import * as esbuild from 'esbuild';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import path from 'path';

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

// Copy CSS
if (existsSync('src/ui/panel.css')) {
  copyFileSync('src/ui/panel.css', 'dist/panel.css');
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
    if (isWatch) {
      const contentCtx = await esbuild.context(contentBuild);
      const backgroundCtx = await esbuild.context(backgroundBuild);

      await Promise.all([contentCtx.watch(), backgroundCtx.watch()]);

      console.log('Watching for changes...');
    } else {
      await Promise.all([esbuild.build(contentBuild), esbuild.build(backgroundBuild)]);

      console.log('Build completed successfully!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
