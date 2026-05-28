import type { EventBus, EventHandler } from '../../ui/core/event-bus'
import type { CapturedMessage } from '../../types'
import { atualizarPerfilOperacionalCliente } from '../cadastro/cliente/atualizar-perfil-operacional-cliente'
import type { CustomerOperationalSignals } from '../cadastro/cliente/types'
import type { ValidadorDeps } from './validador-catalogo'
import { ouvinteLlm } from './ouvinte-llm'
import { customerProfileDB } from '../../storage/customer-profile-db'
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
const chatHistory = new Map<string, { text: string; isOutgoing: boolean }[]>()

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function achouProduto(campos: CampoExtraido[]): boolean {
  return campos.some(c => c.campo === 'preferenciasProduto')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

        // Busca profile atual (se existir)
        const profile = await customerProfileDB.getByChatId(chatId)

        // Busca candidatos do catálogo (validadorCatalogo ainda é usado ANTES do LLM)
        const catalogoCandidatos: string[] = []
        const depsCatalogo = deps?.catalogo
        if (depsCatalogo?.produtos && depsCatalogo.produtos.length > 0) {
          // Pega TOP 5 produtos do catálogo que tenham match parcial no texto
          const matchNomes = depsCatalogo.produtos
            .filter(p => text.toLowerCase().includes(p.nome.toLowerCase().substring(0, 4)))
            .slice(0, 5)
            .map(p => p.nome)
          catalogoCandidatos.push(...matchNomes)
        }

        // Chamada LLM
        const llmOutput = await ouvinteLlm({
          mensagem: text,
          chatId,
          profile,
          catalogoCandidatos,
        })

        console.log('[ouvinte-llm] resultado:', JSON.stringify(llmOutput.extras))

        if (!llmOutput.usouLlm || Object.keys(llmOutput.extras).length === 0) {
          console.log('[ouvinte-llm] sem extração, pulando')
          return
        }

        // Converte LlmExtractionResult → CustomerOperationalSignals
        const sinais: CustomerOperationalSignals = {}
        const e = llmOutput.extras

        if (e.nome) sinais.nomeConfiavel = e.nome
        if (e.endereco) sinais.enderecoEntrega = e.endereco
        if (e.formaPagamento) sinais.formaPagamentoPreferida = [e.formaPagamento]
        if (e.urgencia) Object.assign(sinais, { urgenciaEntrega: e.urgencia })
        if (e.observacoesLogisticas && e.observacoesLogisticas.length > 0) {
          sinais.observacoesLogisticas = e.observacoesLogisticas
        }
        if (e.produtos && e.produtos.length > 0) {
          sinais.preferenciasProduto = e.produtos
            .filter(p => p.nome !== 'desconhecido')
            .map(p => `${p.nome} (${p.quantidade}x)`)
        }
        sinais.lastRecomputeReason = 'turn_end'
        sinais.lastRecomputeAtIso = new Date().toISOString()

        console.log('[ouvinte-llm] persistindo:', sinais)

        const result = await atualizarPerfilOperacionalCliente({ chatId, sinais })
        console.log('[ouvinte-llm] persistência:', result.ok ? 'sim' : 'nao', result.ok ? '' : (result as unknown as { message: string }).message)

        if (result.ok) {
          const camposAtualizados = Object.keys(sinais)
            .filter(k => k !== 'lastRecomputeReason' && k !== 'lastRecomputeAtIso' && k !== 'urgenciaEntrega')

          const event: OuvirProfileUpdatedEvent = {
            chatId,
            camposAtualizados,
            confiancaPerfil: result.data?.confiancaPerfil ?? 0,
          }
          eventBus.emit('ouvir:profile-updated', event)
          console.log('[ouvinte-llm] evento emitido:', camposAtualizados)
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
