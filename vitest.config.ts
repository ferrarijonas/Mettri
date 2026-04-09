import { readFileSync } from 'fs';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'md-as-text',
      load(id) {
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
