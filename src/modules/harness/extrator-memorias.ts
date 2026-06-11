/**
 * Extrator de Memórias via LLM
 *
 * No final de cada turno do AgentLoop, chama o DeepSeek para analisar
 * a interação e extrair memórias nas 4 taxonomias (cliente, licao,
 * negocio, referencia), decidindo escopo (cliente vs global).
 *
 * Se o LLM falhar (sem API key, timeout), retorna vazio — degradação
 * graciosa. O caller decide o fallback.
 *
 * Inspirado no padrão de forked agent do Claude Code.
 */
import { MettriBridgeClient } from '../../content/bridge-client';
import type { AgentTurno } from './types';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';
const STORAGE_KEY_API = 'ds_api_key';

// ── Schema de saída ──

export interface MemoriaExtraida {
  tipo: 'cliente' | 'licao' | 'negocio' | 'referencia';
  descricao: string;
  escopo: 'cliente' | 'global';
  dados?: Record<string, unknown>;
}

// ── Helpers compartilhados ──

/** Pega API key do DeepSeek via bridge (timeout rápido para fallback) */
async function getApiKey(): Promise<string> {
  try {
    const bridge = new MettriBridgeClient(300);
    const storage = await bridge.storageGet([STORAGE_KEY_API]);
    return typeof storage[STORAGE_KEY_API] === 'string'
      ? (storage[STORAGE_KEY_API] as string)
      : '';
  } catch { return ''; }
}

/** Chama DeepSeek com mensagens e retorna texto da resposta, ou null */
async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 30_000,
): Promise<string | null> {
  try {
    const llm = new MettriBridgeClient(timeoutMs);
    const response = await llm.netFetch({
      url: DEEPSEEK_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 1000,
      }),
    });
    if (!response.ok) return null;
    const data = JSON.parse(response.text) as { choices?: { message?: { content?: string | null } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

// ── Prompt ──

const EXTRACTION_SYSTEM_PROMPT = `Você é um analisador de conversas de vendas. Após cada interação entre um atendente (IA) e um cliente, você deve extrair memórias importantes.

Existem 4 tipos de memória:

1. **cliente** — Perfil, preferências, restrições do cliente (sempre escopo cliente)
   Ex: "prefere pagamento no Pix", "reclamou da demora na entrega"

2. **licao** — Lições aprendidas: o que funcionou ou não (escopo variável)
   Escopo cliente: "cliente ficou satisfeito com desconto de 10%"
   Escopo global: "ferramenta consultarPedido está dando timeout"

3. **negocio** — Regras do negócio, metas (sempre global)
   Ex: "entregas somente na região central"

4. **referencia** — Links, códigos, contatos (sempre global)
   Ex: "código do fornecedor FORN-123"

Regras de escopo:
- cliente → sempre "cliente"
- licao → "cliente" se sobre preferências do cliente; "global" se sobre ferramentas/sistema
- negocio → sempre "global"
- referencia → sempre "global"

Só extraia se for ÚTIL para interações futuras. Ignore óbvios.

Retorne APENAS um JSON array de objetos (sem markdown, sem texto extra):
[{ "tipo": "cliente", "descricao": "...", "escopo": "cliente" }]`;

// ── Função principal ──

export interface SalvarTurnoContexto {
  profile?: unknown;
  historicoContexto?: { papel: string; texto: string }[];
  envInfo?: { businessName: string };
  today?: string;
}

export type ExtrairMemoriasParams = { turno: AgentTurno } & SalvarTurnoContexto

/**
 * Chama DeepSeek para extrair memórias estruturadas do turno.
 * @returns array de memórias extraídas, ou [] se falhar
 */
export async function extrairMemoriasLLM(
  params: ExtrairMemoriasParams,
): Promise<MemoriaExtraida[]> {
  const { turno } = params;

  const apiKey = await getApiKey();
  if (!apiKey) return [];

  const toolsBlock = turno.ferramentasChamadas.length > 0
    ? turno.ferramentasChamadas.map(t =>
        `- ${t.nome}: ${t.erro ? `ERRO: ${t.erro}` : `sucesso: ${JSON.stringify(t.resultado)}`}`
      ).join('\n')
    : '(nenhuma ferramenta usada)';

  const userPrompt = [
    `## Turno`,
    `Cliente: ${turno.chatId}`,
    `Mensagem: "${turno.mensagemAtual}"`,
    `Status: ${turno.status}`,
    `Ferramentas chamadas:\n${toolsBlock}`,
    params.profile ? `\n## Perfil do cliente\n${JSON.stringify(params.profile)}` : '',
    params.historicoContexto && params.historicoContexto.length > 0
      ? `\n## Histórico recente\n${params.historicoContexto.slice(-5).map(h => `[${h.papel}] ${h.texto}`).join('\n')}`
      : '',
    params.envInfo ? `\n## Ambiente\nNegócio: ${params.envInfo.businessName}` : '',
    params.today ? `Data: ${params.today}` : '',
    '\nExtraia memórias relevantes como JSON array:',
  ].filter(Boolean).join('\n');

  const content = await callDeepSeek(apiKey, EXTRACTION_SYSTEM_PROMPT, userPrompt);
  if (!content) return [];

  const parsed = parseLLMOutput(content);
  return Array.isArray(parsed) ? parsed : [];
}

// ── Seleção de memórias (retrieval via LLM) ──

const SELECTION_SYSTEM_PROMPT = `Você é um selecionador de memórias para um assistente de vendas.

Dada a mensagem do cliente e uma lista de memórias disponíveis (cada uma com índice, tipo e descrição), escolha APENAS as memórias que são CLARAMENTE relevantes para ajudar o assistente a responder.

Seja seletivo — não inclua memórias duvidosas. Se nenhuma for relevante, retorne array vazio.

Retorne APENAS um JSON array de números com os índices selecionados, sem markdown:
[0, 3, 5]`;

/** Item de memória candidata para seleção */
export interface MemoriaCandidata {
  id?: number;
  descricao: string;
  tipo: string;
}

/**
 * Chama DeepSeek para selecionar memórias relevantes para a mensagem do cliente.
 * @returns índices das memórias selecionadas, ou null se falhar
 */
export async function selecionarMemoriasLLM(
  mensagem: string,
  candidatas: MemoriaCandidata[],
): Promise<number[] | null> {
  if (candidatas.length === 0) return [];

  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const lista = candidatas.map((m, i) =>
    `[${i}] ${m.tipo}: ${m.descricao}`
  ).join('\n');

  const userPrompt = `Mensagem do cliente: "${mensagem}"\n\nMemórias disponíveis:\n${lista}\n\nSelecione os índices relevantes:`;

  const content = await callDeepSeek(apiKey, SELECTION_SYSTEM_PROMPT, userPrompt, 15_000);
  if (!content) return null;

  return parseSelectionOutput(content);
}

/**
 * Parseia output do LLM para array de índices.
 * Aceita: [0, 3, 5] ou ```json [0, 3, 5] ``` ou "0, 3, 5"
 */
function parseSelectionOutput(content: string): number[] | null {
  // Tenta bloco ```json```
  const jsonBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonBlock ? jsonBlock[1].trim() : content.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.every((n: unknown) => typeof n === 'number')) {
      return parsed;
    }
  } catch { /* fallback abaixo */ }

  // Fallback: "0, 3, 5" ou "0 3 5"
  const nums = content.match(/\d+/g);
  if (nums) return nums.map(Number);
  return null;
}

/**
 * Tenta extrair JSON do output do LLM, lidando com markdown ```json ```.
 */
function parseLLMOutput(content: string): MemoriaExtraida[] | null {
  // Tenta extrair bloco ```json ... ```
  const jsonBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonBlock ? jsonBlock[1].trim() : content.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (m: unknown) =>
          m &&
          typeof m === 'object' &&
          ['cliente', 'licao', 'negocio', 'referencia'].includes((m as Record<string, unknown>).tipo as string) &&
          typeof (m as Record<string, unknown>).descricao === 'string' &&
          ['cliente', 'global'].includes((m as Record<string, unknown>).escopo as string),
      );
    }
    return null;
  } catch {
    return null;
  }
}
