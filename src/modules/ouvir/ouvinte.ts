import { EventBus, type EventHandler } from '../../ui/core/event-bus'
import type { CapturedMessage } from '../../types'
import { atualizarPerfilOperacionalCliente } from '../cadastro/cliente/atualizar-perfil-operacional-cliente'
import type { CustomerOperationalSignals } from '../cadastro/cliente/types'
import { extrator } from './extrator'
import { validadorCatalogo, type ValidadorDeps } from './validador-catalogo'
import { sinaisRelease } from './sinais-release'
import { decisorUpdate } from './decisor-update'
import { resolverAmbiguidade } from './ambiguidade'
import type {
  ThrottleState,
  CursorState,
  OuvirProfileUpdatedEvent,
  DecisaoUpdate,
  CampoExtraido,
} from './types'

const THROTTLE_INTERVAL_MS = 5000
const THROTTLE_MAX_BURST = 3
const THROTTLE_WINDOW_MS = 60000

const throttleMap = new Map<string, ThrottleState>()
const cursorMap = new Map<string, CursorState>()

/** Ring buffer: últimas 10 mensagens por chatId (ambas direções). */
const chatHistory = new Map<string, Array<{ text: string; isOutgoing: boolean }>>()

function pushHistory(chatId: string, text: string, isOutgoing: boolean): void {
  const hist = chatHistory.get(chatId) || []
  hist.push({ text, isOutgoing })
  if (hist.length > 10) hist.shift()
  chatHistory.set(chatId, hist)
}

function checkThrottle(chatId: string, timestamp: number): boolean {
  const state = throttleMap.get(chatId)
  const now = timestamp

  if (!state) {
    throttleMap.set(chatId, { chatId, timestamps: [now] })
    return true
  }

  const recent = state.timestamps.filter(t => now - t < THROTTLE_WINDOW_MS)

  if (recent.length >= THROTTLE_MAX_BURST) {
    const elapsed = now - (recent[recent.length - 1] ?? now)
    if (elapsed < THROTTLE_INTERVAL_MS) {
      return false
    }
  }

  recent.push(now)
  state.timestamps = recent.slice(-10)
  return true
}

function checkCursor(chatId: string, timestamp: number): boolean {
  const last = cursorMap.get(chatId)?.ultimaMensagemProcessada
  if (last !== undefined && timestamp <= last) {
    return false
  }
  cursorMap.set(chatId, { chatId, ultimaMensagemProcessada: timestamp })
  return true
}

/** Verifica se extrator achou preferenciasProduto na mensagem. */
function achouProduto(campos: CampoExtraido[]): boolean {
  return campos.some(c => c.campo === 'preferenciasProduto')
}

function convertDecisoesParaSinais(decisoes: DecisaoUpdate[]): CustomerOperationalSignals {
  const sinais: CustomerOperationalSignals = {}

  for (const d of decisoes) {
    if (d.confianca < 0.2) continue

    const valor = d.valor

    switch (d.campo) {
      case 'nome':
        if (typeof valor === 'string') sinais.nomeConfiavel = valor
        break
      case 'preferenciasProduto':
        sinais.preferenciasProduto = Array.isArray(valor) ? valor : typeof valor === 'string' ? [valor] : undefined
        break
      case 'aversoesProduto':
        sinais.aversoesProduto = Array.isArray(valor) ? valor : typeof valor === 'string' ? [valor] : undefined
        break
      case 'enderecoEntrega':
        if (typeof valor === 'string') sinais.enderecoEntrega = valor
        break
      case 'formaPagamentoPreferida':
        sinais.formaPagamentoPreferida = Array.isArray(valor) ? valor : typeof valor === 'string' ? [valor] : undefined
        break
      case 'observacoesLogisticas':
        sinais.observacoesLogisticas = Array.isArray(valor) ? valor : typeof valor === 'string' ? [valor] : undefined
        break
    }
  }

  return sinais
}

function extractCampoValue(valor: string | string[] | undefined): string {
  if (!valor) return ''
  if (Array.isArray(valor)) return valor.join(', ')
  return valor
}

export function registerOuvinteListeners(
  eventBus: EventBus,
  deps?: { catalogo?: ValidadorDeps },
): () => void {
  console.log('[ouvinte] registrando listeners...')
  const handler: EventHandler<{ message?: CapturedMessage }> = (data) => {
    void (async () => {
      try {
        const msg = data?.message
        if (!msg) {
          console.log('[ouvinte] evento sem mensagem')
          return
        }
        console.log('[ouvinte] mensagem recebida:', {
          chatId: msg.chatId?.substring(0, 20),
          isOutgoing: msg.isOutgoing,
          type: msg.type,
          text: (msg.text || '').substring(0, 50),
        })
        if (msg.isOutgoing) {
          console.log('[ouvinte] pulando (outgoing)')
          return
        }

        if (msg.type !== 'text') return

        const text = String(msg.text ?? '').trim()
        if (text.length < 3) {
          console.log('[ouvinte] pulando (texto curto)')
          return
        }

        const chatId = String(msg.chatId ?? '').trim()
        if (!chatId) {
          console.log('[ouvinte] pulando (sem chatId)')
          return
        }
        if (chatId.endsWith('@g.us')) {
          console.log('[ouvinte] pulando (grupo)')
          return
        }

        // Atualiza ring buffer com TODAS as mensagens (inclusive outgoing)
        // antes de qualquer filtro de direção, para dar contexto ao resolver de ambiguidade
        pushHistory(chatId, text, msg.isOutgoing)

        const timestamp = msg.timestamp instanceof Date ? msg.timestamp.getTime() : Date.now()

        if (!checkThrottle(chatId, timestamp)) {
          console.log('[ouvinte] pulando (throttle)')
          return
        }
        if (!checkCursor(chatId, timestamp)) {
          console.log('[ouvinte] pulando (cursor)')
          return
        }

        console.log('[ouvinte] pipeline iniciado para:', chatId.substring(0, 20), text.substring(0, 40))

        const extratorOutput = await extrator({ mensagem: text, chatId })
        console.log('[ouvinte] extrator:', {
          campos: extratorOutput.campos.map(c => `${c.campo}=${Array.isArray(c.valor) ? c.valor.join(',') : c.valor}`),
          urgencia: extratorOutput.urgencia,
          usaLLM: extratorOutput.usaLLM,
        })

        // Se extrator não achou preferenciasProduto, tenta resolver ambiguidade
        let sugestaoPendente: CustomerOperationalSignals['sugestoesPendentes'] = undefined
        if (!achouProduto(extratorOutput.campos)) {
          const resolucao = await resolverAmbiguidade({
            mensagem: text,
            chatId,
            msgId: msg.id,
            replyToId: (msg as any).replyToId,
            quotedText: (msg as any).quotedText,
            historico: chatHistory.get(chatId) || [],
          })
          if (resolucao.resolvido && resolucao.nome) {
            sugestaoPendente = [{
              nome: resolucao.nome,
              qtd: resolucao.qtd,
              nomeExtraido: resolucao.nomeExtraido || `${resolucao.nome} (${resolucao.qtd}x)`,
              confianca: resolucao.confianca || 'baixa',
              metodo: resolucao.metodo || 'llm',
              evidencia: resolucao.evidencia || text,
              criadoEm: new Date().toISOString(),
            }]
            console.log('[ouvinte] ambiguidade resolvida:', {
              nome: resolucao.nome,
              qtd: resolucao.qtd,
              confianca: resolucao.confianca,
              metodo: resolucao.metodo,
            })
          }
        }

        if (extratorOutput.campos.length === 0 && !sugestaoPendente) {
          console.log('[ouvinte] extrator não encontrou campos e sem ambiguidade')
          return
        }

        // Se tem sugestão de ambiguidade, persiste direto (pula validador/sinais/decisor)
        if (sugestaoPendente) {
          const sinais: CustomerOperationalSignals = {
            sugestoesPendentes: sugestaoPendente,
            lastRecomputeReason: 'turn_end',
            lastRecomputeAtIso: new Date().toISOString(),
          }
          console.log('[ouvinte] persistindo sugestão de ambiguidade:', sinais)

          const result = await atualizarPerfilOperacionalCliente({ chatId, sinais })
          console.log('[ouvinte] persistência:', result.ok ? '✅' : '❌', result.ok ? '' : (result as any).message)

          if (result.ok) {
            const event: OuvirProfileUpdatedEvent = {
              chatId,
              camposAtualizados: ['sugestoesPendentes'],
              confiancaPerfil: result.data?.confiancaPerfil ?? 0,
            }
            eventBus.emit('ouvir:profile-updated', event)
          }
          return
        }

        const validadorOutput = validadorCatalogo(
          { campos: extratorOutput.campos },
          deps?.catalogo,
        )

        const camposValidos = validadorOutput.campos.filter(c => c.valido)
        console.log('[ouvinte] validador:', {
          total: validadorOutput.campos.length,
          validos: camposValidos.length,
          invalidos: validadorOutput.campos.filter(c => !c.valido).map(c => c.campo),
        })

        if (camposValidos.length === 0) {
          console.log('[ouvinte] nenhum campo válido, pulando')
          return
        }

        const releaseOutput = sinaisRelease({ mensagem: text })
        console.log('[ouvinte] sinaisRelease:', {
          sinais: releaseOutput.sinais.map(s => `${s.campo}=${s.forca}`),
        })

        const decisorOutput = decisorUpdate({
          camposExtraidos: validadorOutput.campos,
          urgencia: extratorOutput.urgencia,
          sinaisRelease: releaseOutput.sinais,
        })
        console.log('[ouvinte] decisor:', {
          atualizacoes: decisorOutput.atualizacoes.map(d => `${d.campo}=${d.tipo} conf=${d.confianca.toFixed(2)}`),
        })

        if (decisorOutput.atualizacoes.length === 0) {
          console.log('[ouvinte] decisor não gerou atualizações')
          return
        }

        const sinais = convertDecisoesParaSinais(decisorOutput.atualizacoes)
        sinais.lastRecomputeReason = 'turn_end'
        sinais.lastRecomputeAtIso = new Date().toISOString()

        console.log('[ouvinte] persistindo:', sinais)

        const result = await atualizarPerfilOperacionalCliente({ chatId, sinais })
        console.log('[ouvinte] persistência:', result.ok ? '✅' : '❌', result.ok ? '' : (result as any).message)

        if (result.ok) {
          const camposAtualizados = decisorOutput.atualizacoes
            .filter(d => d.confianca >= 0.2)
            .map(d => d.campo)

          const event: OuvirProfileUpdatedEvent = {
            chatId,
            camposAtualizados,
            confiancaPerfil: result.data?.confiancaPerfil ?? 0,
          }
          eventBus.emit('ouvir:profile-updated', event)
          console.log('[ouvinte] evento emitido:', camposAtualizados)
        }
      } catch (error) {
        console.error('[ouvinte] Erro no pipeline:', error)
      }
    })()
  }

  eventBus.on('message:new', handler)

  return () => {
    eventBus.off('message:new', handler)
    throttleMap.clear()
    cursorMap.clear()
    chatHistory.clear()
  }
}
