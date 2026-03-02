/**
 * Teste do RAG fonte no navegador: usa IndexedDB real (não fake-indexeddb).
 * Abra como chrome-extension://[id]/rag-test.html após build.
 */
import { MessageDB } from '../storage/message-db';
import { fonte } from '../modules/rag/fonte';
import type { CapturedMessage } from '../types';

const el = (id: string) => document.getElementById(id)!;

function log(msg: string, isError = false) {
  const p = document.createElement('p');
  p.textContent = msg;
  p.style.color = isError ? '#c00' : '#0a0';
  document.body.appendChild(p);
}

function createMessage(id: string, chatId: string, ts: Date): CapturedMessage {
  return {
    id,
    chatId,
    chatName: 'Test',
    sender: 'Test',
    text: 'test',
    timestamp: ts,
    isOutgoing: false,
    type: 'text',
  };
}

async function run(): Promise<void> {
  const out = el('result');
  out.textContent = 'Rodando… (IndexedDB real)';

  const db = new MessageDB();
  let passed = 0;
  let failed = 0;

  try {
    await db.clearAllMessages();

    // 1) DB vazio → []
    const empty = await fonte({ db });
    if (empty.length === 0) {
      passed++;
      log('✓ DB vazio retorna []');
    } else {
      failed++;
      log(`✗ DB vazio: esperado [], obtido ${empty.length}`, true);
    }

    // 2) Com mensagens → ordem ascendente
    const t1 = createMessage('m1', 'c1', new Date('2026-01-01T11:00:00Z'));
    const t2 = createMessage('m2', 'c1', new Date('2026-01-01T09:00:00Z'));
    const t3 = createMessage('m3', 'c1', new Date('2026-01-01T10:00:00Z'));
    await db.saveMessage(t1);
    await db.saveMessage(t2);
    await db.saveMessage(t3);

    const msgs = await fonte({ chatId: 'c1', db });
    const okOrder = msgs.length === 3 && msgs[0].id === 'm2' && msgs[1].id === 'm3' && msgs[2].id === 'm1';
    if (okOrder) {
      passed++;
      log('✓ Com mensagens: ordem ascendente (m2, m3, m1)');
    } else {
      failed++;
      log(`✗ Ordem: esperado m2,m3,m1, obtido ${msgs.map((m) => m.id).join(',')}`, true);
    }

    await db.clearAllMessages();
  } catch (e) {
    failed++;
    log(`✗ Erro: ${e instanceof Error ? e.message : String(e)}`, true);
  }

  const total = passed + failed;
  if (failed === 0) {
    out.textContent = `OK — ${passed}/${total} testes passaram (IndexedDB real)`;
    out.dataset.status = 'ok';
    out.style.color = '#0a0';
  } else {
    out.textContent = `FALHOU — ${passed}/${total} passaram, ${failed} falharam`;
    out.dataset.status = 'fail';
    out.style.color = '#c00';
  }
}

run();
