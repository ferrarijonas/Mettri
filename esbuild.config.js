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
if (existsSync('src/dev/rag-test.html')) {
  copyFileSync('src/dev/rag-test.html', 'dist/rag-test.html');
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

// Bridge content script (isolated world)
// - Runs in the default isolated world to access chrome.* APIs safely.
// - Communicates with MAIN-world script via window.postMessage.
const bridgeBuild = {
  ...buildOptions,
  entryPoints: ['src/content/bridge.ts'],
  outfile: 'dist/content-bridge.js',
};

// Background service worker
const backgroundBuild = {
  ...buildOptions,
  entryPoints: ['src/background/service-worker.ts'],
  outfile: 'dist/background.js',
};

// Página de teste RAG fonte (IndexedDB real no navegador)
const ragFonteTestBuild = {
  ...buildOptions,
  entryPoints: ['src/dev/rag-fonte-test.ts'],
  outfile: 'dist/rag-fonte-test.js',
  format: 'esm',
};

// Build modules individually for remote updates
async function buildModules() {
  if (!existsSync('dist/modules')) {
    mkdirSync('dist/modules', { recursive: true });
  }

  // Lista de módulos para compilar (apenas os que podem ser atualizados remotamente)
  const modulesToBuild = [
    { id: 'marketing.reactivation', entry: 'src/modules/marketing/reactivation/reactivation-module.ts' },
    { id: 'marketing.retomar', entry: 'src/modules/marketing/retomar/retomar-module.ts' },
    { id: 'marketing.enviar', entry: 'src/modules/marketing/enviar/enviar-module.ts' },
    { id: 'marketing.enviar.retomar', entry: 'src/modules/marketing/enviar/retomar/retomar-module.ts' },
    { id: 'marketing.enviar.responder', entry: 'src/modules/marketing/enviar/responder/responder-module.ts' },
    { id: 'marketing.enviar.divulgar', entry: 'src/modules/marketing/enviar/divulgar/divulgar-module.ts' },
    { id: 'clientes.history', entry: 'src/modules/clientes/history/history-module.ts' },
    { id: 'clientes.directory', entry: 'src/modules/clientes/directory/directory-module.ts' },
    { id: 'atendimento.dashboard', entry: 'src/modules/atendimento/dashboard/dashboard-module.ts' },
    { id: 'infrastructure.tests', entry: 'src/modules/infrastructure/tests/tests-module.ts' },
  ];

  const builds = modulesToBuild.map(module => {
    const globalVarName = `MettriModule_${module.id.replace(/\./g, '_')}`;
    return esbuild.build({
      ...buildOptions,
      entryPoints: [module.entry],
      outfile: `dist/modules/${module.id}.js`,
      format: 'iife',
      globalName: globalVarName,
      // Incluir dependências necessárias
      bundle: true,
      minify: true,
      // Garantir que exports sejam acessíveis
      banner: {
        js: `// Module: ${module.id}\n`,
      },
      footer: {
        js: `
// Auto-register module if register function is available in global scope
(function() {
  try {
    // Try to find register function from parent scope (passed as parameter)
    if (typeof register === 'function') {
      // Find module definition (could be named differently per module)
      var moduleDef = null;
      var moduleNames = ['ReactivationModule', 'RetomarModule', 'EnviarModule', 'HistoryModule', 'DirectoryModule', 'DashboardModule', 'TestsModule', 'MarketingModule', 'AtendimentoModule', 'ClientesModule', 'InfrastructureModule', 'EnviarRetomarModule', 'EnviarResponderModule', 'EnviarDivulgarModule'];
      for (var i = 0; i < moduleNames.length; i++) {
        if (typeof window[moduleNames[i]] !== 'undefined') {
          moduleDef = window[moduleNames[i]];
          break;
        }
      }
      // Also check global variable
      if (!moduleDef && typeof ${globalVarName} !== 'undefined') {
        if (${globalVarName}.module) {
          moduleDef = ${globalVarName}.module;
        } else if (${globalVarName}.id) {
          moduleDef = ${globalVarName};
        }
      }
      if (moduleDef && moduleDef.id) {
        register(moduleDef);
      }
    }
    // Export to global for fallback access
    if (typeof window !== 'undefined') {
      window.${globalVarName} = typeof ${globalVarName} !== 'undefined' ? ${globalVarName} : null;
    }
  } catch (e) {
    console.warn('[ModuleLoader] Error auto-registering module:', e);
  }
})();
`,
      },
    });
  });

  try {
    await Promise.all(builds);
    console.log(`✓ Compiled ${modulesToBuild.length} modules`);
    return modulesToBuild.map(m => ({ id: m.id, path: `dist/modules/${m.id}.js` }));
  } catch (error) {
    console.error('Error building modules:', error);
    throw error;
  }
}

async function build() {
  try {
    // Process CSS first (before building JS)
    if (existsSync('src/ui/tailwind-input.css')) {
      await processCSS('src/ui/tailwind-input.css', 'dist/panel.css');
    } else if (existsSync('src/ui/panel.css')) {
      copyFileSync('src/ui/panel.css', 'dist/panel.css');
    }

    // Se flag --modules-only, compilar apenas módulos
    if (process.argv.includes('--modules-only')) {
      await buildModules();
      return;
    }

    if (isWatch) {
      const contentCtx = await esbuild.context(contentBuild);
      const bridgeCtx = await esbuild.context(bridgeBuild);
      const backgroundCtx = await esbuild.context(backgroundBuild);
      const ragTestCtx = await esbuild.context(ragFonteTestBuild);

      await Promise.all([contentCtx.watch(), bridgeCtx.watch(), backgroundCtx.watch(), ragTestCtx.watch()]);

      console.log('Watching for changes...');
    } else {
      await Promise.all([
        esbuild.build(contentBuild),
        esbuild.build(bridgeBuild),
        esbuild.build(backgroundBuild),
        esbuild.build(ragFonteTestBuild),
      ]);

      console.log('Build completed successfully!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Exportar função para uso em scripts
if (typeof module !== 'undefined') {
  module.exports = { buildModules };
}

build();
