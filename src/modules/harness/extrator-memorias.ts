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

  // 1. Pega API key (timeout curto — falha rápido se não houver bridge)
  let apiKey = '';
  try {
    const bridge = new MettriBridgeClient(300);
    const storage = await bridge.storageGet([STORAGE_KEY_API]);
    apiKey = typeof storage[STORAGE_KEY_API] === 'string'
      ? (storage[STORAGE_KEY_API] as string)
      : '';
  } catch {
    return [];
  }

  if (!apiKey) return [];

  // 2. Monta mensagens
  const systemPrompt = EXTRACTION_SYSTEM_PROMPT;

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

  const messages: Record<string, unknown>[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // 3. Chama DeepSeek
  try {
    const llm = new MettriBridgeClient(30_000);
    const response = await llm.netFetch({
      url: DEEPSEEK_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) return [];

    const data = JSON.parse(response.text) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    // 4. Parse JSON do conteúdo
    const parsed = parseLLMOutput(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
