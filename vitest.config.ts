import { readFileSync, statSync } from 'fs';
import { basename } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'md-as-text',
      load(id) {
        const norm = id.replace(/\\/g, '/');
        if (basename(norm) === 'agente_retomar.md') {
          const text = readFileSync(id, 'utf-8');
          const iso = statSync(id).mtime.toISOString();
          return (
            `export default ${JSON.stringify(text)};\n` +
            `export const AGENTE_RETOMAR_PROMPT_LAST_MODIFIED_ISO = ${JSON.stringify(iso)};\n`
          );
        }
        if (id.endsWith('.md')) {
          const text = readFileSync(id, 'utf-8');
          return `export default ${JSON.stringify(text)};`;
        }
      },
    },
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
});
