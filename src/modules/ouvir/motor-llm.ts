/**
 * Módulo de extração LLM para o Ouvinte.
 *
 * Substitui os ~55 regex heurísticos do extrator por uma chamada DeepSeek por mensagem,
 * com extração delta (só o que falta no perfil) + contexto do catálogo.
 *
 * Usa o MettriBridgeClient (storageGet + netFetch) para contornar o CSP
 * do WhatsApp Web e acessar chrome.storage.local do service worker.
 */

import { MettriBridgeClient } from '../../content/bridge-client'
import type { LlmExtractionResult, OuvinteLlmInput, OuvinteLlmOutput, EstadoPercebido, MensagemHistorico } from './types'
import type { CustomerOperationalProfile } from '../../storage/customer-profile-db'
import { montarPrompt } from './monta-prompt'
import type { ToolDescription, LlmToolResponse } from '../harness/types'
import type { ContextoMemorias } from '../harness/memory-store'
import type { EnvInfo } from '../harness/env-config'
import { parsearRespostaTools } from '../harness/llm-tool-parser'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'
const STORAGE_KEY_API = 'mettri:deepseek:apiKey'

/**
 * Tenta extrair JSON da resposta do LLM.
 * Strip ```json ... ``` se presente.
 */
function parseResponse(text: string): LlmExtractionResult {
  let cleaned = text.trim()
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === 'object' && parsed !== null) {
      return normalizeResult(parsed as Record<string, unknown>)
    }
  } catch {
    // fallback silencioso
  }
  return {}
}

/**
 * Normaliza campos da resposta LLM para o schema LlmExtractionResult.
 * Corrige variações comuns:
 * - "urgente" (pt) → "urgencia" (schema)
 * - "produto" (singular) → "produtos" (plural)
 * - "metodoPagamento" → "formaPagamento"
 */
function normalizeResult(raw: Record<string, unknown>): LlmExtractionResult {
  const out: Record<string, unknown> = {}

  // Mapa de aliases: nome alternativo → nome canônico
  const fieldMap: Record<string, string> = {
    urgente: 'urgencia',
    urgencia: 'urgencia',
    produto: 'produtos',
    produtos: 'produtos',
    metodoPagamento: 'formaPagamento',
    formaPagamento: 'formaPagamento',
    forma_pagamento: 'formaPagamento',
    endereco: 'endereco',
    enderecoEntrega: 'endereco',
    observacoes: 'observacoesLogisticas',
    observacoesLogisticas: 'observacoesLogisticas',
    logistica: 'observacoesLogisticas',
    retratacao: 'retratacoes',
    retratacoes: 'retratacoes',
    nome: 'nome',
    nomeConfiavel: 'nome',
    resposta: 'respostaSugerida',
    respostaSugerida: 'respostaSugerida',
    confirmacao: 'respostaSugerida',
  }

  for (const [key, value] of Object.entries(raw)) {
    const canonical = fieldMap[key.toLowerCase().trim()] || key
    out[canonical] = value
  }

  // Valida/limpa urgencia: só aceita string "alta"|"normal"|"baixa"
  // Normaliza "media" → "normal" (variação comum do LLM)
  if (out.urgencia !== undefined) {
    if (typeof out.urgencia === 'string') {
      const v = out.urgencia.toLowerCase()
      if (v === 'media') out.urgencia = 'normal'
      else if (['alta', 'normal', 'baixa'].includes(v)) out.urgencia = v as 'alta' | 'normal' | 'baixa'
    } else {
      delete out.urgencia
    }
  }

  // Valida produtos: garante que é array com shape correto
  if (out.produtos !== undefined) {
    if (Array.isArray(out.produtos)) {
      out.produtos = out.produtos
        .filter((p: unknown) => p && typeof p === 'object')
        .map((p: Record<string, unknown>) => ({
          nome: String(p.nome ?? 'desconhecido'),
          quantidade: typeof p.quantidade === 'number' ? p.quantidade : (typeof p.quantidade === 'string' ? parseInt(p.quantidade, 10) || 1 : 1),
          confianca: (['alta', 'media', 'baixa'].includes(String(p.confianca)) ? String(p.confianca) : 'media') as 'alta' | 'media' | 'baixa',
        }))
    } else {
      delete out.produtos
    }
  }

  // Valida aversoes: mesmo shape de produtos, sem quantidade
  if (out.aversoes !== undefined) {
    if (Array.isArray(out.aversoes)) {
      out.aversoes = out.aversoes
        .filter((a: unknown) => a && typeof a === 'object')
        .map((a: Record<string, unknown>) => ({
          nome: String(a.nome ?? 'desconhecido'),
          confianca: (['alta', 'media', 'baixa'].includes(String(a.confianca)) ? String(a.confianca) : 'media') as 'alta' | 'media' | 'baixa',
        }))
    } else {
      delete out.aversoes
    }
  }

  // Valida respostaSugerida: string, trim, max 200 chars
  if (out.respostaSugerida !== undefined) {
    if (typeof out.respostaSugerida === 'string') {
      const trimmed = out.respostaSugerida.trim()
      out.respostaSugerida = trimmed.length > 200 ? trimmed.substring(0, 200) : trimmed
      if (!out.respostaSugerida) delete out.respostaSugerida
    } else {
      delete out.respostaSugerida
    }
  }

  // Garante que arrays vazios sejam removidos
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key]) && (out[key] as unknown[]).length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete out[key]
    }
  }

  return out as LlmExtractionResult
}

/**
 * Extrai perfil do cliente a partir da mensagem via DeepSeek.
 *
 * Fallback silencioso: se LLM falhar, retorna vazio — não quebra o pipeline.
 */
export async function ouvinteLlm(input: OuvinteLlmInput): Promise<OuvinteLlmOutput> {
  // Mensagens muito curtas não valem chamada de API
  if (input.mensagem.length < 10) {
    return { extras: {}, usouLlm: false, tokensEstimados: 0 }
  }

  const bridge = new MettriBridgeClient(30_000)

  // Pega API key do storage
  let apiKey = ''
  try {
    const obj = await bridge.storageGet([STORAGE_KEY_API])
    apiKey = typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : ''
  } catch (err) {
    return { extras: {}, usouLlm: false, tokensEstimados: 0, erro: `bridge: ${(err as Error)?.message || String(err)}` }
  }

  if (!apiKey) {
    return { extras: {}, usouLlm: false, tokensEstimados: 0, erro: 'API key não configurada (Settings > DeepSeek)' }
  }

  // System prompt montado por seções (identidade + contexto + extração + resposta)
  const prompt = montarPrompt({
    identidade: true,
    contextoConversa: true,
    extracao: true,
    resposta: true,
    profile: input.profile,
    mensagem: input.mensagem,
    catalogoCandidatos: input.catalogoCandidatos,
    estadoPercebido: input.estadoPercebido,
    historicoContexto: input.historicoContexto,
    intencaoAnterior: input.intencaoAnterior,
  })

  try {
    const hasTools = input.tools !== undefined && input.tools.length > 0

    // ── Monta body dinamicamente ──
    const body: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: 'system', content: prompt.systemPrompt },
        { role: 'user', content: prompt.userPrompt },
      ],
      temperature: 0,
      max_tokens: hasTools ? 1000 : 500,
    }

    // DEBUG: log prompt
    console.log('[deepseek-debug] mensagem:', input.mensagem)
    console.log('[deepseek-debug] catalogo:', JSON.stringify(input.catalogoCandidatos))
    console.log('[deepseek-debug] systemPrompt (final 300):', prompt.systemPrompt.slice(-300))
    console.log('[deepseek-debug] userPrompt (final 300):', prompt.userPrompt.slice(-300))

    // Adiciona tools se fornecidas (DeepSeek function calling)
    if (hasTools && input.tools) {
      body.tools = input.tools as ToolDescription[]
      body.tool_choice = 'auto'
    }

    const result = await bridge.netFetch({
      url: DEEPSEEK_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!result.ok) {
      const msg = result.status === 402
        ? 'DeepSeek: saldo insuficiente'
        : result.status === 401
          ? 'DeepSeek: chave API inválida'
          : result.status === 429
            ? 'DeepSeek: limite de taxa excedido'
            : `DeepSeek: HTTP ${result.status}`
      console.warn(`[deepseek] ${msg}`)
      return { extras: {}, usouLlm: false, tokensEstimados: 0, erro: msg }
    }

    const data = JSON.parse(result.text) as {
      choices?: { message?: { content?: string | null; tool_calls?: unknown[] } }[]
      usage?: { total_tokens?: number }
    }
    const message = data.choices?.[0]?.message
    const content = message?.content ?? null
    const toolCallsRaw = message?.tool_calls
    const tokensEstimados = data.usage?.total_tokens ?? 0

    // DEBUG: log raw response
    console.log('[deepseek-debug] raw content:', (content ?? '(null)').slice(0, 500))

    // ── Parseia resposta com suporte a tools ──
    const llmToolResponse = parsearRespostaTools(content, toolCallsRaw)

    // Se for tool_use, não tem extração de perfil — retorna só o tool response
    if (llmToolResponse.tipo === 'tool_use') {
      return {
        extras: {},
        usouLlm: true,
        tokensEstimados,
        llmToolResponse,
      }
    }

    // Se for responder com texto vazio (fallback), retorna erro
    if (llmToolResponse.tipo === 'responder' && !llmToolResponse.texto) {
      return { extras: {}, usouLlm: false, tokensEstimados: 0, erro: llmToolResponse.erro || 'DeepSeek respondeu vazio' }
    }

    // ── Parseia extração de perfil normal ──
    const extras = parseResponse(content ?? '')

    return {
      extras,
      usouLlm: true,
      tokensEstimados,
      llmToolResponse,
    }
  } catch (err) {
    console.warn('[deepseek] exceção na chamada LLM:', err)
    return { extras: {}, usouLlm: false, tokensEstimados: 0, erro: `DeepSeek: ${(err as Error)?.message || String(err)}` }
  }
}

// ── Agent Decision ──

export interface AgenteDecidirInput {
  mensagem: string;
  chatId: string;
  tools: ToolDescription[];
  toolResults: { nome: string; argumentos: Record<string, unknown>; resultado: unknown; erro?: string }[];
  profile?: CustomerOperationalProfile | null;
  catalogoCandidatos?: string[];
  estadoPercebido?: EstadoPercebido;
  historicoContexto?: MensagemHistorico[];
  /** Memórias persistentes para contexto (4 tipos) */
  memorias?: ContextoMemorias;
  /** Informações de ambiente */
  envInfo?: EnvInfo;
  /** Data formatada */
  today?: string;
  /** Informações das ferramentas para gerar seção dinâmica no prompt */
  toolInfos?: { nome: string; descricao: string; categoria: string }[];
  /** Causa do despertar do agente */
  causa?: 'mensagem_recebida' | 'reativacao' | 'continuar_turno';
}

/**
 * Converte um ZodType para JSON Schema no formato que a DeepSeek/OpenAI aceita.
 */
export function zodTypeToJsonSchema(schema: unknown): Record<string, unknown> {
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
        shape = ((current as Record<string, unknown>).shape as Record<string, unknown>) ?? {};
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
      return {};
  }
}

function isFieldOptional(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const def = (schema as Record<string, unknown>)._def as Record<string, unknown> | undefined;
  if (!def?.typeName) return false;
  const tn = def.typeName as string;
  if (tn === 'ZodOptional') return true;
  if (tn === 'ZodDefault') return true;
  if (tn === 'ZodReadonly') return isFieldOptional(def.innerType);
  if (tn === 'ZodEffects') return isFieldOptional((def.schema ?? def.innerType) as unknown);
  return false;
}

/**
 * Chama DeepSeek com function calling para o AgentLoop.
 * Usa montarPrompt() com seção `decisao` em vez de prompt hardcoded.
 * Incorpora toolResults no histórico da conversa para feedback ao LLM.
 */
export async function agenteDecidir(
  input: AgenteDecidirInput,
): Promise<LlmToolResponse> {
  const { mensagem, tools, toolResults, chatId } = input;

  let apiKey = '';
  try {
    const bridgeClient = new MettriBridgeClient(5000);
    const storage = await bridgeClient.storageGet([STORAGE_KEY_API]);
    apiKey = typeof storage[STORAGE_KEY_API] === 'string' ? (storage[STORAGE_KEY_API] as string) : '';
  } catch (err) {
    return { tipo: 'responder', texto: '', erro: `bridge: ${(err as Error)?.message || String(err)}` };
  }

  if (!apiKey) {
    return { tipo: 'responder', texto: '', erro: 'API key não configurada (Settings > DeepSeek)' };
  }

  // Usa montarPrompt com seção decisao (em vez de extracao/resposta)
  const prompt = montarPrompt({
    identidade: true,
    contextoConversa: true,
    decisao: true,
    mensagem,
    chatId,
    catalogoCandidatos: input.catalogoCandidatos ?? [],
    profile: input.profile ?? null,
    estadoPercebido: input.estadoPercebido,
    historicoContexto: input.historicoContexto,
    memorias: input.memorias,
    envInfo: input.envInfo,
    today: input.today,
    tools: input.toolInfos,
    causa: input.causa,
  });

  // Monta mensagens com tool results no histórico
  const messages: Record<string, unknown>[] = [
    { role: 'system', content: prompt.systemPrompt },
  ];

  // Adiciona tool_results como assistant + tool messages antes da user message
  for (const tr of toolResults) {
    const toolCallId = `call_${tr.nome}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: toolCallId, type: 'function', function: { name: tr.nome, arguments: JSON.stringify(tr.argumentos) } }],
    });
    messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: tr.erro ? JSON.stringify({ erro: tr.erro }) : JSON.stringify(tr.resultado ?? {}),
    });
  }

  messages.push({ role: 'user', content: prompt.userPrompt });

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

  try {
    const llmBridge = new MettriBridgeClient(60_000);
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      temperature: 0,
      max_tokens: 1000,
    };
    if (deepseekTools.length > 0) {
      body.tools = deepseekTools;
      body.tool_choice = 'auto';
    }

    const response = await llmBridge.netFetch({
      url: DEEPSEEK_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const msg = response.status === 402
        ? 'DeepSeek: saldo insuficiente'
        : response.status === 401
          ? 'DeepSeek: chave API inválida'
          : response.status === 429
            ? 'DeepSeek: limite de taxa excedido'
            : `DeepSeek: HTTP ${response.status}`;
      return { tipo: 'responder', texto: '', erro: msg };
    }

    const data = JSON.parse(response.text) as {
      choices?: { message?: { content?: string | null; tool_calls?: unknown[] } }[];
    };
    const choice = data.choices?.[0];
    if (!choice) return { tipo: 'responder', texto: '', erro: 'DeepSeek: resposta sem choices' };

    const content: string | null = choice.message?.content ?? null;
    const toolCalls: unknown[] = choice.message?.tool_calls ?? [];

    return parsearRespostaTools(content, toolCalls);
  } catch (err) {
    return { tipo: 'responder', texto: '', erro: `DeepSeek: ${(err as Error)?.message || String(err)}` };
  }
}
