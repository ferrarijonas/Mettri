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
import type { LlmExtractionResult, OuvinteLlmInput, OuvinteLlmOutput } from './types'
import { montarPrompt } from './monta-prompt'

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
  } catch {
    return { extras: {}, usouLlm: false, tokensEstimados: 0 }
  }

  if (!apiKey) {
    return { extras: {}, usouLlm: false, tokensEstimados: 0 }
  }

  // System prompt montado por seções (identidade + extração + resposta)
  const prompt = montarPrompt({
    identidade: true,
    extracao: true,
    resposta: true,
    profile: input.profile,
    mensagem: input.mensagem,
    catalogoCandidatos: input.catalogoCandidatos,
  })

  try {
    const result = await bridge.netFetch({
      url: DEEPSEEK_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    })

    if (!result.ok) {
      return { extras: {}, usouLlm: false, tokensEstimados: 0 }
    }

    const data = JSON.parse(result.text) as {
      choices?: { message?: { content?: string } }[]
      usage?: { total_tokens?: number }
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return { extras: {}, usouLlm: false, tokensEstimados: 0 }
    }

    const extras = parseResponse(content)
    const tokensEstimados = data.usage?.total_tokens ?? 0

    return {
      extras,
      usouLlm: true,
      tokensEstimados,
    }
  } catch {
    return { extras: {}, usouLlm: false, tokensEstimados: 0 }
  }
}
