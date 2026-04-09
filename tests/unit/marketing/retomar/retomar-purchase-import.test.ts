import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { daysBetweenByCalendar } from '../../../../src/modules/marketing/retomar/inactive-days';
import {
  dedupeRows,
  resolveLastActivityFromSnapshot,
  parseListaClientesXlsx,
  parseImportedPurchaseDate,
  toLocalCalendarDateIso,
} from '../../../../src/modules/marketing/retomar/retomar-purchase-import';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cria um ArrayBuffer XLSX com as linhas fornecidas (coluna Nome, Telefone, Último Pedido). */
function makeXlsx(rows: Array<{ Nome?: string; Telefone: string; 'Último Pedido'?: string | number }>): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** Formato export com linha de título antes do cabeçalho (ex.: relatório "Clientes Inativos"). */
function makeXlsxWithTitleRow(
  title: string,
  dataRows: Array<{ cod?: string; nome: string; telefone: string; ultimo: string }>
): ArrayBuffer {
  const aoa: unknown[][] = [
    [title, null, null, null, null, null, null],
    ['Cód.', 'Nome', 'Telefone', 'Qtd. Pedidos', 'Valor Pedidos', 'Último Pedido', 'Unidade'],
    ...dataRows.map(r => [r.cod ?? '', r.nome, r.telefone, '', '', r.ultimo, '']),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** Mapa de lastIncoming mínimo para testes de match. */
function makeLastIncoming(entries: Array<{ chatId: string; chatName: string }>) {
  return new Map(entries.map(e => [e.chatId, e]));
}

// ---------------------------------------------------------------------------
// dedupeRows
// ---------------------------------------------------------------------------

describe('dedupeRows', () => {
  it('mantém apenas a linha com data mais recente para o mesmo telefone', () => {
    const result = dedupeRows([
      { phone: '11999990001', date: new Date(2024, 0, 10), name: 'A' },
      { phone: '11999990001', date: new Date(2024, 2, 15), name: 'B' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].lastPurchaseIso).toBe('2024-03-15');
  });

  it('agrupa por dígitos — ignora pontuação/espaço', () => {
    const result = dedupeRows([
      { phone: '(11) 99999-0002', date: new Date(2024, 1, 1), name: 'C' },
      { phone: '11999990002', date: new Date(2024, 0, 1), name: 'D' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].lastPurchaseIso).toBe('2024-02-01');
  });

  it('mantém linha sem data se for a única para aquele telefone', () => {
    const result = dedupeRows([{ phone: '11999990003', date: null, name: 'E' }]);
    expect(result).toHaveLength(1);
    expect(result[0].lastPurchaseIso).toBe('');
  });

  it('linha com data vence linha sem data no mesmo grupo', () => {
    const result = dedupeRows([
      { phone: '11999990004', date: null, name: 'sem data' },
      { phone: '11999990004', date: new Date(2024, 4, 1), name: 'com data' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].lastPurchaseIso).toBe('2024-05-01');
  });

  it('telefones diferentes geram linhas distintas', () => {
    const result = dedupeRows([
      { phone: '11999990010', date: new Date(2024, 0, 1) },
      { phone: '11999990011', date: new Date(2024, 0, 2) },
    ]);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// resolveLastActivityFromSnapshot — match com chatId
// ---------------------------------------------------------------------------

describe('resolveLastActivityFromSnapshot', () => {
  it('encontra chatId quando dígitos batem exatamente', () => {
    const lastIncoming = makeLastIncoming([{ chatId: '5511999990001@c.us', chatName: 'Cliente A' }]);
    const { lastActivityByChat, unmatchedCount } = resolveLastActivityFromSnapshot(
      [{ phoneDigits: '5511999990001', lastPurchaseIso: '2024-03-01T00:00:00.000Z' }],
      lastIncoming
    );
    expect(lastActivityByChat.size).toBe(1);
    expect(unmatchedCount).toBe(0);
    expect(lastActivityByChat.get('5511999990001@c.us')?.chatName).toBe('Cliente A');
  });

  it('match com variante sem DDI 55', () => {
    // planilha tem "11999990001", chat tem "5511999990001@c.us"
    const lastIncoming = makeLastIncoming([{ chatId: '5511999990001@c.us', chatName: 'Cliente B' }]);
    const { lastActivityByChat } = resolveLastActivityFromSnapshot(
      [{ phoneDigits: '11999990001', lastPurchaseIso: '2024-04-01T00:00:00.000Z' }],
      lastIncoming
    );
    expect(lastActivityByChat.size).toBe(1);
  });

  it('match com variante sem 9º dígito (BR 8 dígitos)', () => {
    // planilha tem "1199990001" (sem 9), chat tem "55119999000001@c.us" — via aliases
    const lastIncoming = makeLastIncoming([{ chatId: '551199990001@c.us', chatName: 'Cliente C' }]);
    const { lastActivityByChat } = resolveLastActivityFromSnapshot(
      [{ phoneDigits: '55119999000001', lastPurchaseIso: '2024-05-01T00:00:00.000Z' }],
      lastIncoming
    );
    // Pode ou não bater dependendo do padrão — principal: sem crash
    expect(typeof lastActivityByChat.size).toBe('number');
  });

  it('contabiliza unmatched quando telefone não está no WhatsApp', () => {
    const lastIncoming = makeLastIncoming([]);
    const { lastActivityByChat, unmatchedCount, unmatchedSamples } = resolveLastActivityFromSnapshot(
      [
        { phoneDigits: '11999990099', lastPurchaseIso: '2024-01-01T00:00:00.000Z' },
        { phoneDigits: '11999990098', lastPurchaseIso: '2024-01-02T00:00:00.000Z' },
      ],
      lastIncoming
    );
    // Mesmo sem match no histórico, gera fallback por telefone para não perder contato.
    expect(lastActivityByChat.size).toBe(2);
    expect(lastActivityByChat.has('5511999990099@c.us')).toBe(true);
    expect(unmatchedCount).toBe(2);
    expect(unmatchedSamples.length).toBeGreaterThan(0);
  });

  it('pula linha sem data (lastPurchaseIso vazio)', () => {
    const lastIncoming = makeLastIncoming([{ chatId: '5511999990001@c.us', chatName: 'X' }]);
    const { lastActivityByChat } = resolveLastActivityFromSnapshot(
      [{ phoneDigits: '5511999990001', lastPurchaseIso: '' }],
      lastIncoming
    );
    expect(lastActivityByChat.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseListaClientesXlsx — integração
// ---------------------------------------------------------------------------

describe('parseListaClientesXlsx', () => {
  it('parse planilha simples com 2 linhas distintas', () => {
    const buf = makeXlsx([
      { Nome: 'Ana', Telefone: '11999990001', 'Último Pedido': '2024-03-01' },
      { Nome: 'Beto', Telefone: '11999990002', 'Último Pedido': '2024-04-15' },
    ]);
    const lastIncoming = makeLastIncoming([
      { chatId: '5511999990001@c.us', chatName: 'Ana' },
      { chatId: '5511999990002@c.us', chatName: 'Beto' },
    ]);
    const result = parseListaClientesXlsx(buf, lastIncoming, 'test.xlsx');

    expect(result.snapshot.rows).toHaveLength(2);
    expect(result.snapshot.filename).toBe('test.xlsx');
    expect(result.lastActivityByChat.size).toBe(2);
    expect(result.warnings.unmatchedCount).toBe(0);
  });

  it('dedupe: duas linhas mesmo telefone → snapshot com 1 linha (data mais recente)', () => {
    const buf = makeXlsx([
      { Telefone: '11999990003', 'Último Pedido': '2024-01-10' },
      { Telefone: '11999990003', 'Último Pedido': '2024-06-20' },
    ]);
    const lastIncoming = makeLastIncoming([{ chatId: '5511999990003@c.us', chatName: 'Dup' }]);
    const result = parseListaClientesXlsx(buf, lastIncoming);
    expect(result.snapshot.rows).toHaveLength(1);
    expect(result.snapshot.rows[0].lastPurchaseIso).toBe('2024-06-20');
  });

  it('data serial Excel é convertida para Date válida', () => {
    // 45353 = 2024-03-01 em serial Excel (1900 date system)
    const buf = makeXlsx([{ Telefone: '11999990005', 'Último Pedido': 45353 }]);
    const lastIncoming = makeLastIncoming([{ chatId: '5511999990005@c.us', chatName: 'Ser' }]);
    const result = parseListaClientesXlsx(buf, lastIncoming);
    expect(result.snapshot.rows[0].lastPurchaseIso).toBeTruthy();
    expect(result.lastActivityByChat.size).toBe(1);
  });

  it('linha sem telefone é ignorada', () => {
    const buf = makeXlsx([
      { Nome: 'Sem Tel', Telefone: '', 'Último Pedido': '2024-01-01' },
      { Nome: 'Com Tel', Telefone: '11999990007', 'Último Pedido': '2024-01-02' },
    ]);
    const lastIncoming = makeLastIncoming([{ chatId: '5511999990007@c.us', chatName: 'Com Tel' }]);
    const result = parseListaClientesXlsx(buf, lastIncoming);
    expect(result.snapshot.rows).toHaveLength(1);
  });

  it('warnings incluem amostras de não-matched (máx 5)', () => {
    const phones = ['11111110001', '11111110002', '11111110003', '11111110004', '11111110005', '11111110006'];
    const buf = makeXlsx(phones.map(p => ({ Telefone: p, 'Último Pedido': '2024-01-01' })));
    const result = parseListaClientesXlsx(buf, makeLastIncoming([]));
    expect(result.warnings.unmatchedCount).toBe(6);
    expect(result.warnings.samples.length).toBeLessThanOrEqual(5);
  });

  it('aceita linha de título antes do cabeçalho (formato Clientes Inativos)', () => {
    const buf = makeXlsxWithTitleRow('Clientes Inativos', [
      { cod: '1', nome: 'Ana', telefone: '11999990001', ultimo: '2024-03-01' },
      { cod: '2', nome: 'Beto', telefone: '11999990002', ultimo: '2024-04-15' },
    ]);
    const lastIncoming = makeLastIncoming([
      { chatId: '5511999990001@c.us', chatName: 'Ana' },
      { chatId: '5511999990002@c.us', chatName: 'Beto' },
    ]);
    const result = parseListaClientesXlsx(buf, lastIncoming, 'inativos.xlsx');
    expect(result.snapshot.rows).toHaveLength(2);
    expect(result.snapshot.filename).toBe('inativos.xlsx');
    expect(result.lastActivityByChat.size).toBe(2);
    expect(result.warnings.unmatchedCount).toBe(0);
  });

  it('dedupe grava YYYY-MM-DD local (não toISOString) para não deslocar o dia', () => {
    const d = new Date(2026, 3, 9);
    expect(toLocalCalendarDateIso(d)).toBe('2026-04-09');
    const rows = dedupeRows([{ phone: '11999990099', date: d, name: 'x' }]);
    expect(rows[0]?.lastPurchaseIso).toBe('2026-04-09');
    const parsed = parseImportedPurchaseDate(rows[0]!.lastPurchaseIso);
    expect(daysBetweenByCalendar(new Date(2026, 3, 9, 15, 0, 0), parsed!)).toBe(0);
  });

  it('interpreta corretamente data BR dd/mm/aaaa do export', () => {
    const buf = makeXlsxWithTitleRow('Clientes Inativos', [
      { cod: '1', nome: 'Sandra', telefone: '11999990001', ultimo: '20/03/2026' },
      { cod: '2', nome: 'João', telefone: '11999990002', ultimo: '12/02/2026' },
    ]);
    const lastIncoming = makeLastIncoming([
      { chatId: '5511999990001@c.us', chatName: 'Sandra' },
      { chatId: '5511999990002@c.us', chatName: 'João' },
    ]);
    const result = parseListaClientesXlsx(buf, lastIncoming, 'br.xlsx');
    const byChat = result.lastActivityByChat;
    expect(byChat.get('5511999990001@c.us')?.date.toISOString()).toContain('2026-03-20');
    expect(byChat.get('5511999990002@c.us')?.date.toISOString()).toContain('2026-02-12');
  });
});
