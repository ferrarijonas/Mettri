# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Mettri is a Chrome Extension (Manifest V3) that injects a CRM panel into WhatsApp Web. It is a purely client-side TypeScript project bundled with esbuild. There is no backend server to run.

### Available commands

See `package.json` scripts. Key ones:

| Command | Purpose |
|---------|---------|
| `npm run dev` | esbuild watch mode (rebuilds on file changes) |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint on `src/` |
| `npm run type-check` | `tsc --noEmit` |
| `npm run test:unit` | Vitest unit tests (4 test files, 54 tests) |
| `npm run test:e2e` | Playwright E2E tests (requires built `dist/` and WhatsApp Web) |

### Known pre-existing issues (as of v2.0.1)

- **Build fails** due to missing source modules: `src/infrastructure/active-chat-service.ts`, `src/storage/client-db.ts`, `src/modules/marketing/reactivation/inactive-days.ts`, `src/modules/clientes/name-likelihood.ts`, `src/infrastructure/services.ts`. These are imported but not yet implemented. Two of three entry points (`background.js`, `content-bridge.js`) build successfully; only `content.js` fails.
- **Lint** reports ~596 errors and ~355 warnings (pre-existing — many `no-explicit-any` and `no-console` violations).
- **Type-check** reports ~20 errors (pre-existing — related to the same missing modules and some type issues).
- **E2E tests** have a config bug (`__dirname` used in ES module scope in `playwright.config.ts`) and also require WhatsApp Web, which blocks automation (bot detection).

### Testing constraints

- **Unit tests** (`npm run test:unit`) work fully in the cloud environment and should always pass.
- **E2E / manual testing on WhatsApp Web** is not possible in cloud environments — WhatsApp Web detects automation tools (Playwright/Puppeteer) and blocks loading. Manual testing requires a real Chrome browser opened by a human.
- **No backend services** are needed. The extension is fully client-side.
