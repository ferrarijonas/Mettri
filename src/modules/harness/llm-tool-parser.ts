/**
 * Parseia a resposta do LLM para extrair tool calls ou texto puro.
 *
 * DeepSeek (e OpenAI) retornam tool_calls no formato:
 * ```json
 * {
 *   "choices": [{
 *     "message": {
 *       "content": null,
 *       "tool_calls": [{
 *         "type": "function",
 *         "function": { "name": "...", "arguments": "{\"key\": \"val\"}" }
 *       }]
 *     }
 *   }]
 * }
 * ```
 *
 * Esta função converte essa resposta bruta em LlmToolResponse:
 * - Se tool_calls presente → tool_use
 * - Se content com texto → responder
 * - Se content com JSON { "preciso_ferramenta": true } → preciso_ferramenta
 * - Fallback: responder com texto vazio (nunca quebra)
 */
import type { LlmToolResponse } from './types'

/**
 * Parseia a resposta do LLM com suporte a function calling.
 *
 * @param raw - Conteúdo textual da resposta (message.content)
 * @param toolCallsRaw - Array bruto de tool_calls da resposta da API (message.tool_calls)
 * @returns LlmToolResponse — sempre retorna algo, nunca quebra
 */
export function parsearRespostaTools(
  raw: string | null | undefined,
  toolCallsRaw?: unknown[],
): LlmToolResponse {
  // ── Caso 1: tool_calls presente ──
  if (toolCallsRaw && Array.isArray(toolCallsRaw) && toolCallsRaw.length > 0) {
    try {
      const first = toolCallsRaw[0] as Record<string, unknown>
      const fn = first?.function as Record<string, unknown> | undefined
      if (fn && typeof fn.name === 'string') {
        const nome = fn.name
        let argumentos: Record<string, unknown> = {}

        if (typeof fn.arguments === 'string') {
          try {
            argumentos = JSON.parse(fn.arguments) as Record<string, unknown>
          } catch {
            // arguments não é JSON válido — usa vazio
          }
        } else if (fn.arguments && typeof fn.arguments === 'object') {
          argumentos = fn.arguments as Record<string, unknown>
        }

        return {
          tipo: 'tool_use',
          nome,
          argumentos,
        }
      }
    } catch {
      // Fallback silencioso
    }
  }

  // ── Caso 2: content ausente ou vazio ──
  if (!raw || raw.trim().length === 0) {
    return { tipo: 'responder', texto: '' }
  }

  // ── Caso 3: content com JSON { "preciso_ferramenta": true } ──
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('```')) {
    let jsonStr = trimmed
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && parsed.preciso_ferramenta === true) {
        return {
          tipo: 'preciso_ferramenta',
          nomeSugerido: typeof parsed.nomeSugerido === 'string' ? parsed.nomeSugerido : 'ferramenta_desconhecida',
          descricao: typeof parsed.descricao === 'string' ? parsed.descricao : '',
          entradaEsperada: (parsed.entradaEsperada && typeof parsed.entradaEsperada === 'object')
            ? parsed.entradaEsperada as Record<string, string>
            : {},
          saidaEsperada: (parsed.saidaEsperada && typeof parsed.saidaEsperada === 'object')
            ? parsed.saidaEsperada as Record<string, string>
            : {},
          porQuePreciso: typeof parsed.porQuePreciso === 'string' ? parsed.porQuePreciso : '',
        }
      }
    } catch {
      // Não é JSON válido — trata como texto normal
    }
  }

  // ── Caso 4: content com texto puro ──
  return { tipo: 'responder', texto: trimmed }
}
