import { createServer } from 'http';
import { appendFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT = resolve(__dirname, '..', '..', '.karma', 'tmp', 'debug-retomar.jsonl');
mkdirSync(resolve(__dirname, '..', '..', '.karma', 'tmp'), { recursive: true });

const server = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      appendFileSync(OUT, body + '\n');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    } catch (e) {
      res.writeHead(500);
      res.end('erro');
    }
  });
});

server.listen(9223, () => {
  console.log(`[debug-retomar] ouvindo :9223 → ${OUT}`);
  console.log('[debug-retomar] rode a extensão e gere frases. Ctrl+C para parar.');
});
