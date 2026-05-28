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

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const MODEL = 'deepseek-chat'
const STORAGE_KEY_API = 'mettri:deepseek:apiKey'

/**
 * Monta o prompt do usuário como JSON estruturado:
 * mensagem + catálogo candidatos + perfil atual (só campos preenchidos).
 */
function buildUserPrompt(input: OuvinteLlmInput): string {
  const perfilAtual: Record<string, unknown> = {}
  const p = input.profile
  if (p) {
    if (p.nomeConfiavel) perfilAtual.nome = p.nomeConfiavel
    if (p.enderecoEntrega) perfilAtual.endereco = p.enderecoEntrega
    if (p.formaPagamentoPreferida && p.formaPagamentoPreferida.length > 0) {
      perfilAtual.formaPagamento = p.formaPagamentoPreferida
    }
    if (p.preferenciasProduto && p.preferenciasProduto.length > 0) {
      perfilAtual.produtos_existentes = p.preferenciasProduto
    }
  }

  return JSON.stringify({
    mensagem: input.mensagem,
    catalogo: input.catalogoCandidatos,
    perfil_atual: perfilAtual,
  })
}

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
      return parsed as LlmExtractionResult
    }
  } catch {
    // fallback silencioso
  }
  return {}
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

  const systemPrompt = [
    'Você é um extrator de perfil de clientes de padaria.',
    'Dada a mensagem do cliente, os produtos do catálogo e o perfil já conhecido,',
    'extraia APENAS o que é NOVO ou MUDOU em relação ao perfil atual.',
    'Retorne APENAS JSON válido, sem markdown, sem explicações.',
    '',
    'Regras:',
    '- Só extraia campos que estão null/vazios no perfil_atual',
    '- Se "nome" já está preenchido no perfil → IGNORE (não reextraia)',
    '- Se "endereco" já está preenchido no perfil → IGNORE',
    '- Produtos: retorne APENAS os que existem no array "catalogo" (faça fuzzy match com o nome do catálogo)',
    '- Se um produto mencionado não existe no catálogo, retorne como {"nome": "desconhecido", ...}',
    '- Urgência: sempre extraia (pode mudar a cada mensagem)',
    '- Se a mensagem contradiz pedidos anteriores (ex: "sem coca"), inclua em "retratacoes"',
  ].join('\n')

  const userPrompt = buildUserPrompt(input)

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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
