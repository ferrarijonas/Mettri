#!/usr/bin/env node
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const baseUrl = process.env.BASE_URL || 'https://ferrarijonas.github.io/Mettri';
const dryRun = process.argv.includes('--dry-run');

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;

if (!existsSync(join(root, 'dist'))) {
  console.error('ERRO: Pasta dist/ nao encontrada!');
  process.exit(1);
}
if (!existsSync(join(root, 'dist', 'modules'))) {
  console.error('ERRO: Pasta dist/modules/ nao encontrada!');
  process.exit(1);
}

const updatesDir = join(root, 'modules-updates');
const versionDir = join(updatesDir, 'v' + version);
mkdirSync(updatesDir, { recursive: true });
mkdirSync(versionDir, { recursive: true });

const manifest = { version, updatedAt: new Date().toISOString(), modules: [] };
const files = readdirSync(join(root, 'dist', 'modules')).filter(f => f.endsWith('.js'));
for (const file of files) {
  const moduleId = file.replace(/\.js$/, '');
  const srcPath = join(root, 'dist', 'modules', file);
  const content = readFileSync(srcPath, 'utf8');
  const hash = sha256(content);
  if (!dryRun) copyFileSync(srcPath, join(versionDir, file));
  manifest.modules.push({ id: moduleId, version, url: baseUrl + '/v' + version + '/' + file, hash });
  console.log('  OK: ' + moduleId + ' (hash: ' + hash.slice(0, 8) + '...)');
}
writeFileSync(join(updatesDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('Manifest gerado: modules-updates/manifest.json');
