/**
 * Serviço de mapeamento de compras: amostra, conceito OpenAI, persistência.
 * Spec: specs/cadastro/spec.md
 */

import type { CapturedMessage } from '../../../types';
import type { ConceptResult, PurchaseItem } from './types';
import { messageDB } from '../../../storage/message-db';
import { purchaseDB } from '../../../storage/purchase-db';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

/** Monta transcript determinístico: [ISO] [Cliente|Loja] texto */
export function buildTranscript(messages: CapturedMessage[]): string {
  const sorted = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return sorted
    .map((m) => {
      const iso = m.timestamp.toISOString();
      const who = m.isOutgoing ? 'Loja' : 'Cliente';
      const text = m.type === 'text' ? m.text : `[${m.type}]`;
      return `${iso} ${who} ${text}`;
    })
    .join('\n');
}

/** Tipo do bridge exposto no MAIN world (window.MettriBridge) */
interface MettriBridgeNetFetch {
  netFetch(args: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{ ok: boolean; status: number; text: string }>;
}

function getBridge(): MettriBridgeNetFetch | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { MettriBridge?: MettriBridgeNetFetch };
  return w.MettriBridge ?? null;
}

/**
 * Chama OpenAI via bridge (isolated world) → background. O painel roda em MAIN world
 * (sem chrome); o bridge faz o NET_FETCH no service worker para evitar CSP do WhatsApp.
 */
async function callOpenAI(
  apiKey: string,
  system: string,
  user: string,
  jsonMode = false
): Promise<string> {
  const bridge = getBridge();
  if (!bridge?.netFetch) {
    throw new Error(
      'Bridge não disponível. Aguarde o Mettri sincronizar (ícone "Sincronizado" no painel) e tente novamente.'
    );
  }
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature: 0.2,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  const result = await bridge.netFetch({
    url: OPENAI_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    throw new Error(`OpenAI ${result.status}: ${result.text}`);
  }
  const data = JSON.parse(result.text) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI respondeu sem conteúdo');
  return content;
}

/** Extrai conceito a partir dos transcripts dos 3 chats */
export async function extractConcept(
  apiKey: string,
  transcripts: { chatName: string; transcript: string }[]
): Promise<ConceptResult> {
  const userContent = transcripts
    .map((t) => `--- Conversa: ${t.chatName} ---\n${t.transcript}`)
    .join('\n\n');
  const system = `Analisa as conversas de WhatsApp abaixo (Loja = vendedor, Cliente = comprador).
Retorna um único JSON com exatamente estas chaves:
- "conceptText": string com 2-3 frases descrevendo como os clientes costumam pedir e quais dados aparecem (data, valor, itens).
- "examplePayloads": array de objetos com chaves opcionais: "date" (ISO), "value" (number), "items" (array de string), "notes" (string). Um ou dois exemplos do formato de compra.`;
  const raw = await callOpenAI(apiKey, system, userContent, true);
  const parsed = parseJsonFromResponse(raw);
  const conceptText = typeof parsed.conceptText === 'string' ? parsed.conceptText : '';
  const examplePayloads = Array.isArray(parsed.examplePayloads)
    ? parsed.examplePayloads.filter(
        (p): p is { date: string; value?: number; items?: string[]; notes?: string } =>
          !!p && typeof p === 'object' && typeof (p as { date?: unknown }).date === 'string'
      )
    : [];
  return { conceptText, examplePayloads };
}

/** Extrai compras de um transcript (um chat) */
export async function extractPurchases(
  apiKey: string,
  chatId: string,
  transcript: string,
  conceptText: string
): Promise<PurchaseItem[]> {
  const userContent = conceptText
    ? `Contexto do negócio:\n${conceptText}\n\n--- Conversa ---\n${transcript}`
    : transcript;
  const system = `Lista todas as compras identificáveis nesta conversa.
Retorna um único JSON: { "purchases": [ { "date": "ISO-8601", "value": number ou null, "items": array ou null, "notes": string ou null } ] }.
Se não houver compra, retorna { "purchases": [] }.
"date" é obrigatório para cada compra.`;
  const raw = await callOpenAI(apiKey, system, userContent, true);
  const parsed = parseJsonFromResponse(raw);
  const arr = Array.isArray(parsed.purchases) ? parsed.purchases : [];
  return arr.map((p: Record<string, unknown>) => ({
    date: typeof p.date === 'string' ? p.date : '',
    value: typeof p.value === 'number' ? p.value : null,
    items: Array.isArray(p.items) ? p.items.filter((x): x is string => typeof x === 'string') : null,
    notes: typeof p.notes === 'string' ? p.notes : null,
  }));
}

function parseJsonFromResponse(raw: string): Record<string, unknown> {
  let s = raw.trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s) as Record<string, unknown>;
}

/** Carrega pool de amostra: top 6 por messageCount */
export async function loadSamplePool(): Promise<
  { chatId: string; chatName: string; messageCount: number }[]
> {
  const map = await messageDB.groupMessagesByContact();
  const list = Array.from(map.entries())
    .map(([chatId, info]) => ({
      chatId,
      chatName: info.chatName,
      messageCount: info.messageCount,
    }))
    .filter((c) => c.messageCount >= 1)
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 6);
  return list;
}

/** Retorna lista de chatIds para mapeamento em massa (messageCount >= 1) */
export async function loadAllChatIds(): Promise<string[]> {
  const map = await messageDB.groupMessagesByContact();
  return Array.from(map.keys()).filter((id) => (map.get(id)?.messageCount ?? 0) >= 1);
}

/** Busca até N mensagens de um chat, ordenadas por timestamp ascendente */
export async function getMessagesForChat(chatId: string, limit: number): Promise<CapturedMessage[]> {
  const list = await messageDB.getMessages(chatId, limit);
  return list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/** Persiste uma compra no PurchaseDB com source AI_DETECTED */
export async function persistPurchase(
  chatId: string,
  item: PurchaseItem
): Promise<void> {
  const date = new Date(item.date);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data inválida: ${item.date}`);
  }
  const value =
    item.value !== undefined && item.value !== null && item.value >= 0 ? item.value : undefined;
  await purchaseDB.addPurchase({
    chatId,
    purchaseDate: date,
    value,
    items: Array.isArray(item.items) ? item.items : undefined,
    notes: typeof item.notes === 'string' ? item.notes : undefined,
    source: 'AI_DETECTED',
  });
}
