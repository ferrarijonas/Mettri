/**
 * agente-llm — Motor de decisão com DeepSeek + function calling.
 *
 * Substitui o mockDecidir() do AgentLoop por uma chamada real ao LLM.
 * Reutiliza MettriBridgeClient para buscar API key do storage e fazer o fetch,
 * e parsearRespostaTools para interpretar a resposta da DeepSeek.
 *
 * Conforme T-040: "Substituir mockDecidir() por chamada real ao DeepSeek".
 */
import type { ToolDescription, LlmToolResponse, ToolCall } from './types';
import { parsearRespostaTools } from './llm-tool-parser';
import { MettriBridgeClient } from '../../content/bridge-client';

// ── Input da função ──

export interface AgenteDecidirInput {
  mensagem: string;
  chatId: string;
  tools: ToolDescription[];
  toolResults: ToolCall[];
  ferramentasDisponiveis: string[];
}

// ── Zod → JSON Schema (pragmático, cobre os tipos usados) ──

/**
 * Converte um ZodType para JSON Schema no formato que a DeepSeek/OpenAI aceita.
 *
 * Cobre: string, number, boolean, array, object + wrappers (optional, default,
 * readonly, effects). Descrições via `.describe()` são preservadas.
 */
export function zodTypeToJsonSchema(schema: unknown): Record<string, unknown> {
  // Extrai descrição antes de unwrap (pode estar no wrapper)
  let topDesc: string | undefined;
  let scan = schema;
  const visited = new Set<unknown>();
  while (scan && typeof scan === 'object' && !visited.has(scan)) {
    visited.add(scan);
    const d = (scan as Record<string, unknown>)._def as
      | Record<string, unknown>
      | undefined;
    if (d?.description && typeof d.description === 'string') {
      topDesc = d.description as string;
    }
    const tn = d?.typeName as string | undefined;
    if (tn === 'ZodOptional' || tn === 'ZodDefault' || tn === 'ZodReadonly') {
      scan = d?.innerType;
    } else if (tn === 'ZodEffects') {
      scan = (d?.schema ?? d?.innerType) as unknown;
    } else {
      break;
    }
  }

  // Unwrap wrappers até chegar ao tipo real
  let current = schema;
  while (current && typeof current === 'object') {
    const def = (current as Record<string, unknown>)._def as
      | Record<string, unknown>
      | undefined;
    if (!def?.typeName) break;
    const tn = def.typeName as string;
    if (tn === 'ZodOptional' || tn === 'ZodDefault' || tn === 'ZodReadonly') {
      current = def.innerType;
      continue;
    }
    if (tn === 'ZodEffects') {
      current = (def.schema ?? def.innerType) as unknown;
      continue;
    }
    break;
  }

  if (!current || typeof current !== 'object') return {};

  const def = (current as Record<string, unknown>)._def as
    | Record<string, unknown>
    | undefined;
  if (!def?.typeName) return {};

  const typeName = def.typeName as string;
  const result: Record<string, unknown> = {};
  if (topDesc) result.description = topDesc;

  switch (typeName) {
    case 'ZodString':
      return { ...result, type: 'string' };

    case 'ZodNumber':
      return { ...result, type: 'number' };

    case 'ZodBoolean':
      return { ...result, type: 'boolean' };

    case 'ZodArray': {
      result.type = 'array';
      result.items = zodTypeToJsonSchema(def.type);
      return result;
    }

    case 'ZodObject': {
      result.type = 'object';
      let shape: Record<string, unknown> = {};
      try {
        shape = ((current as Record<string, unknown>).shape as Record<
          string,
          unknown
        >) ?? {};
      } catch {
        // shape getter pode lançar se não for um objeto válido
      }

      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const key of Object.keys(shape)) {
        properties[key] = zodTypeToJsonSchema(shape[key]);
        if (!isFieldOptional(shape[key])) {
          required.push(key);
        }
      }

      result.properties = properties;
      if (required.length > 0) result.required = required;
      return result;
    }

    default:
      // Tipos não mapeados (union, literal, etc.) — retorna schema vazio
      return {};
  }
}

/**
 * Verifica se um campo Zod é opcional (ZodOptional, ZodDefault) ou tem default.
 * Usado para determinar se uma propriedade deve entrar no array `required` do JSON Schema.
 */
function isFieldOptional(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const def = (schema as Record<string, unknown>)._def as
    | Record<string, unknown>
    | undefined;
  if (!def?.typeName) return false;
  const tn = def.typeName as string;
  if (tn === 'ZodOptional') return true;
  if (tn === 'ZodDefault') return true;
  if (tn === 'ZodReadonly') return isFieldOptional(def.innerType);
  if (tn === 'ZodEffects')
    return isFieldOptional(
      (def.schema ?? def.innerType) as unknown,
    );
  return false;
}

// ── Chamada DeepSeek ──

/**
 * Chama a API DeepSeek com function calling e retorna a decisão parseada.
 *
 * Fluxo:
 * 1. Busca API key do storage via MettriBridgeClient
 * 2. Constrói mensagens (system + user + tool_results)
 * 3. Envia requisição POST para /v1/chat/completions
 * 4. Parseia resposta com parsearRespostaTools
 * 5. Fallback silencioso se API key não configurada ou erro de rede
 */
export async function agenteDecidir(
  input: AgenteDecidirInput,
): Promise<LlmToolResponse> {
  const { mensagem, tools, toolResults, ferramentasDisponiveis } = input;

  // ── 1. Buscar API key via bridge ──
  let apiKey: string | undefined;
  try {
    const bridgeClient = new MettriBridgeClient(5000);
    const storage = await bridgeClient.storageGet([
      'mettri:deepseek:apiKey',
    ]);
    apiKey = storage['mettri:deepseek:apiKey'] as string | undefined;
  } catch {
    // Bridge não disponível (ex: ambiente de teste sem Chrome)
    return { tipo: 'responder', texto: '' };
  }

  if (!apiKey) {
    // API key não configurada — fallback silencioso
    return { tipo: 'responder', texto: '' };
  }

  // ── 2. Construir mensagens ──
  const messages: Record<string, unknown>[] = [];

  // System prompt
  const toolsList =
    ferramentasDisponiveis.length > 0
      ? ferramentasDisponiveis.map((n) => `- ${n}`).join('\n')
      : '(nenhuma ferramenta disponível)';
  messages.push({
    role: 'system',
    content: `Você é um assistente de padaria. Com base na mensagem do cliente, decida qual ferramenta chamar ou responda diretamente. Ferramentas disponíveis:\n${toolsList}`,
  });

  // User message (mensagem original do cliente)
  messages.push({ role: 'user', content: mensagem });

  // Histórico de tool calls já executadas neste turno
  for (const tr of toolResults) {
    const toolCallId = `call_${tr.nome}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Assistant message com tool_call
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: toolCallId,
          type: 'function',
          function: {
            name: tr.nome,
            arguments: JSON.stringify(tr.argumentos),
          },
        },
      ],
    });

    // Tool result message
    messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: tr.erro
        ? JSON.stringify({ erro: tr.erro })
        : JSON.stringify(tr.resultado ?? {}),
    });
  }

  // ── 3. Montar tools no formato DeepSeek ──
  const deepseekTools = tools
    .filter((t) => t.function?.name)
    .map((t) => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description ?? '',
        parameters: t.function.parameters ?? { type: 'object' },
      },
    }));

  // ── 4. Chamar DeepSeek API via bridge ──
  try {
    const llmBridge = new MettriBridgeClient(60_000);
    const response = await llmBridge.netFetch({
      url: 'https://api.deepseek.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0,
        tools: deepseekTools.length > 0 ? deepseekTools : undefined,
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      console.error(
        '[AgentLLM] DeepSeek API error:',
        response.status,
        response.text,
      );
      return { tipo: 'responder', texto: '' };
    }

    const data = JSON.parse(response.text) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: unknown[];
        };
      }[];
    };
    const choice = data.choices?.[0];
    if (!choice) {
      return { tipo: 'responder', texto: '' };
    }

    const content: string | null = choice.message?.content ?? null;
    const toolCalls: unknown[] = choice.message?.tool_calls ?? [];

    return parsearRespostaTools(content, toolCalls);
  } catch (err) {
    console.error('[AgentLLM] Failed to call DeepSeek:', err);
    return { tipo: 'responder', texto: '' };
  }
}
