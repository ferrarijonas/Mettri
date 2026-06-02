import type { EventBus, EventHandler } from '../../ui/core/event-bus'
import type { CapturedMessage } from '../../types'
import { atualizarPerfilOperacionalCliente } from '../cadastro/cliente/atualizar-perfil-operacional-cliente'
import type { CustomerOperationalSignals } from '../cadastro/cliente/types'
import { ouvinteLlm } from './motor-llm'
import { checkThrottle, checkCursor, limparLimitadores } from './limitador'
import { customerProfileDB } from '../../storage/customer-profile-db'
import { catalogoDB } from '../../storage/catalogo-db'
import { messageDB } from '../../storage/message-db'
import { orderDB } from '../../storage/order-db'
import type { OuvirProfileUpdatedEvent, EstadoPercebido, MensagemHistorico } from './types'

/** Ring buffer: últimas 10 mensagens por chatId (ambas direções). */
const chatHistory = new Map<string, { text: string; isOutgoing: boolean }[]>()

/** Contador de turnos consecutivos com confiança baixa por chatId */
const turnosBaixaConfianca = new Map<string, number>()

/** Última intenção classificada por chatId */
const ultimaIntencaoPorChat = new Map<string, string>()

function pushHistory(chatId: string, text: string, isOutgoing: boolean): void {
  const hist = chatHistory.get(chatId) || []
  hist.push({ text, isOutgoing })
  if (hist.length > 10) hist.shift()
  chatHistory.set(chatId, hist)
}

// ── Estado Percebido ──

/**
 * Calcula o EstadoPercebido a partir do perfil operacional e dos pedidos ativos.
 * Consulta orderDB para determinar a fase do pedido.
 */
/**
 * Tenta obter clientKey a partir de um profile.
 * CustomerOperationalProfile não tem clientKey no schema,
 * mas alguns registros podem ter via passthrough.
 * Fallback: retorna chatId para busca heurística.
 */
function getClientKeyFromProfile(profile: import('../../storage/customer-profile-db').CustomerOperationalProfile | null, chatId: string): string | null {
  // Tenta acessar como any por passthrough
  const p = profile as Record<string, unknown> | null
  const key = p?.clientKey
  if (typeof key === 'string' && key.length > 0) return key
  return null
}

/**
 * Calcula o EstadoPercebido a partir do perfil operacional.
 * Usa o perfil para determinar fase, confiança e o que já foi coletado.
 * A consulta ao orderDB é feita via clientKey se disponível, senão usa heurística.
 */
async function calcularEstadoPercebido(
  chatId: string,
  profile: import('../../storage/customer-profile-db').CustomerOperationalProfile | null,
  intencaoAtual?: string,
): Promise<EstadoPercebido> {
  try {
    const p = profile
    const temProdutos = (p?.preferenciasProduto?.length ?? 0) > 0
    const temEndereco = !!p?.enderecoEntrega
    const temPagamento = (p?.formaPagamentoPreferida?.length ?? 0) > 0
    const temPrazo = !!p?.urgenciaEntrega

    let fase: EstadoPercebido['fase'] = 'indeterminado'
    let confiancaEstado: EstadoPercebido['confiancaEstado'] = 'baixa'

    // Tenta obter clientKey para consultar orderDB
    const clientKey = getClientKeyFromProfile(profile, chatId)
    let temPedidoAtivo = false

    if (clientKey) {
      try {
        const pedidosAtivos = await orderDB.listActiveByClientKey(clientKey, 5)
        if (pedidosAtivos.length > 0) {
          temPedidoAtivo = true
          const status = pedidosAtivos[0].status
          if (status === 'lead') fase = 'lead'
          else if (status === 'draft') fase = 'draft'
          else if (status === 'open' || status === 'awaiting_payment') fase = 'open'
          else if (status === 'completed') {
            fase = intencaoAtual === 'suporte_pos_venda' ? 'pos_venda' : 'completed'
          }
        } else if (intencaoAtual === 'suporte_pos_venda') {
          fase = 'pos_venda'
        }
      } catch {
        // Fallback: continar sem orderDB
      }
    } else if (intencaoAtual === 'suporte_pos_venda') {
      // Mesmo sem clientKey, se intenção é pós-venda, assumimos pós-venda
      fase = 'pos_venda'
    }

    // Confiança: se tem pedido ativo E produtos → alta
    // Se tem um dos dois → media
    // Nenhum → baixa
    const temPedidoEmAberto = temPedidoAtivo && fase !== 'completed' && fase !== 'pos_venda'
    if (temPedidoEmAberto && temProdutos) {
      confiancaEstado = 'alta'
    } else if (temPedidoEmAberto || temProdutos) {
      confiancaEstado = 'media'
    } else {
      confiancaEstado = 'baixa'
    }

    // Se está em pós-venda, confiança é media (contexto pode ser necessário)
    if (fase === 'pos_venda') {
      confiancaEstado = 'media'
    }

    // precisaContextoExtra: se confiança baixa por 2+ turnos consecutivos
    const turnosBaixa = turnosBaixaConfianca.get(chatId) ?? 0
    const precisaContextoExtra = confiancaEstado === 'baixa' && turnosBaixa >= 2

    return {
      fase,
      coletado: {
        produtos: temProdutos,
        endereco: temEndereco,
        pagamento: temPagamento,
        prazo: temPrazo,
      },
      confiancaEstado,
      precisaContextoExtra,
      ultimaVerificacao: new Date().toISOString(),
    }
  } catch {
    // Fallback silencioso: indeterminado + baixa
    return {
      fase: 'indeterminado',
      coletado: { produtos: false, endereco: false, pagamento: false, prazo: false },
      confiancaEstado: 'baixa',
      precisaContextoExtra: true,
      ultimaVerificacao: new Date().toISOString(),
    }
  }
}

/** Decide a quantidade de mensagens de histórico a enviar baseado no EstadoPercebido. */
function decidirTamanhoHistorico(
  estado: EstadoPercebido,
  ringBufferSize: number,
  intencaoAtual?: string,
  intencaoAnterior?: string,
): number {
  if (ringBufferSize === 0) return 0 // Primeira mensagem

  // Tabela de estratégia
  if (estado.precisaContextoExtra) return Math.min(15, ringBufferSize) // Máximo
  if (estado.confiancaEstado === 'baixa') return Math.min(10, ringBufferSize)
  if (estado.confiancaEstado === 'media') return Math.min(5, ringBufferSize)
  if (intencaoAtual && intencaoAnterior && intencaoAtual !== intencaoAnterior) return Math.min(8, ringBufferSize)
  if (estado.confiancaEstado === 'alta') return Math.min(1, ringBufferSize)

  return Math.min(1, ringBufferSize)
}

/** Converte ring buffer para MensagemHistorico (formato do prompt). */
function ringBufferParaContexto(
  hist: { text: string; isOutgoing: boolean }[],
  tamanho: number,
  incluirUltima?: boolean,
): MensagemHistorico[] {
  const slice = hist.slice(-tamanho)
  // Se incluirUltima for false e o tamanho for > 1, remove a última (que é a msg atual)
  const msgs = incluirUltima === false && slice.length > 1 ? slice.slice(0, -1) : slice
  return msgs.map(h => ({
    papel: h.isOutgoing ? 'atendente' as const : 'cliente' as const,
    texto: h.text,
  }))
}

// ── Registro de listeners ──

export function registerOuvinteListeners(
  eventBus: EventBus,
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

        // Emite evento de processamento IMEDIATAMENTE (antes do throttle/LLM)
        // para o dashboard mostrar um skeleton/bloco vazio sem delay
        eventBus.emit('ouvir:processing', {
          chatId,
          startedAtIso: new Date().toISOString(),
        } satisfies import('./types').OuvirProcessingEvent)

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

        // Busca candidatos do catálogo diretamente do banco local
        const catalogoCandidatos: string[] = []
        try {
          const accountId = catalogoDB.getCurrentUserWid() || 'default'
          const produtos = await catalogoDB.listByAccount(accountId)
          if (produtos.length > 0) {
            const matchNomes = produtos
              .filter(p => {
                const msg = text.toLowerCase()
                const nome = p.nome.toLowerCase()
                // Match se QUALQUER palavra do nome (≥3 chars) aparece na mensagem
                // Ex: msg="multigrãos" matcha com nome "Pão Multigrãos" via "multigrãos"
                const palavras = nome.split(/\s+/).filter(w => w.length > 2)
                return palavras.some(palavra => msg.includes(palavra))
              })
              .slice(0, 5)
              .map(p => p.nome)
            catalogoCandidatos.push(...matchNomes)
          }
        } catch {
          // Catálogo indisponível — LLM extrai livremente
        }

        console.log('[ouvinte-llm] input:', {
          mensagem: text,
          chatId: chatId.substring(0, 20),
          profileTemDados: !!profile?.nomeConfiavel,
          catalogoCandidatos,
        })

        // ── Estado Percebido ──
        const intencaoAnterior = ultimaIntencaoPorChat.get(chatId)
        const estado = await calcularEstadoPercebido(chatId, profile, intencaoAnterior)
        const intencaoAtual = intencaoAnterior // será atualizada após LLM

        // ── Tamanho do histórico ──
        const ringBuffer = chatHistory.get(chatId) ?? []
        const tamanhoHistorico = decidirTamanhoHistorico(estado, ringBuffer.length, intencaoAtual, intencaoAnterior)
        const historicoContexto = tamanhoHistorico > 0
          ? ringBufferParaContexto(ringBuffer, tamanhoHistorico, false)
          : undefined

        // Atualiza contador de turnos de baixa confiança
        if (estado.confiancaEstado === 'baixa') {
          turnosBaixaConfianca.set(chatId, (turnosBaixaConfianca.get(chatId) ?? 0) + 1)
        } else {
          turnosBaixaConfianca.set(chatId, 0)
        }

        console.log('[ouvinte-llm] estado percebido:', {
          fase: estado.fase,
          confianca: estado.confiancaEstado,
          historicoEnviado: tamanhoHistorico,
          precisaContextoExtra: estado.precisaContextoExtra,
        })

        // Chamada LLM
        const llmOutput = await ouvinteLlm({
          mensagem: text,
          chatId,
          profile,
          catalogoCandidatos,
          estadoPercebido: estado,
          historicoContexto,
          intencaoAnterior,
        })

        console.log('[ouvinte-llm] resultado:', JSON.stringify(llmOutput.extras))

        // Atualiza intenção anterior para o próximo turno
        if (llmOutput.extras.intencao) {
          ultimaIntencaoPorChat.set(chatId, llmOutput.extras.intencao)
        }

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
        if (e.urgencia) sinais.urgenciaEntrega = e.urgencia
        if (e.observacoesLogisticas && e.observacoesLogisticas.length > 0) {
          sinais.observacoesLogisticas = e.observacoesLogisticas
        }
        if (e.produtos && e.produtos.length > 0) {
          // Produtos com confiança alta/media → preferências (persiste)
          const produtosConfiaveis = e.produtos.filter(p => p.confianca !== 'baixa' && p.nome !== 'desconhecido')
          if (produtosConfiaveis.length > 0) {
            sinais.preferenciasProduto = produtosConfiaveis.map(p => `${p.nome} (${p.quantidade}x)`)
          }
          // Produtos com confiança baixa → sugestão pendente (atendente decide)
          const produtosBaixa = e.produtos.filter(p => p.confianca === 'baixa' && p.nome !== 'desconhecido')
          if (produtosBaixa.length > 0) {
            const agora = new Date().toISOString()
            sinais.sugestoesPendentes = produtosBaixa.map(p => ({
              nome: p.nome,
              qtd: p.quantidade,
              nomeExtraido: p.nome,
              confianca: 'baixa' as const,
              metodo: 'llm' as const,
              evidencia: text,
              criadoEm: agora,
            }))
          }
        }
        if (e.aversoes && e.aversoes.length > 0) {
          sinais.aversoesProduto = e.aversoes.map(a => a.nome)
        }
        // retratacoes não vira campo no perfil — sinaliza pro merge.
        // Se houver retratação, o atualizarPerfilOperacionalCliente
        // já lida com conflitos via pendentesConfirmacao.
        sinais.lastRecomputeReason = 'turn_end'
        sinais.lastRecomputeAtIso = new Date().toISOString()

        console.log('[ouvinte-llm] persistindo:', sinais)

        const result = await atualizarPerfilOperacionalCliente({ chatId, sinais })
        console.log('[ouvinte-llm] persistência:', result.ok ? 'sim' : 'nao', result.ok ? '' : (result as unknown as { message: string }).message)

        if (result.ok) {
          const camposAtualizados = Object.keys(sinais)
            .filter(k => k !== 'lastRecomputeReason' && k !== 'lastRecomputeAtIso')

          // Se o LLM classificou a intenção ou gerou resposta, propaga no evento
          const intencao = e.intencao
          const respostaSugerida = e.respostaSugerida

          const event: OuvirProfileUpdatedEvent = {
            chatId,
            camposAtualizados,
            confiancaPerfil: result.data?.confiancaPerfil ?? 0,
            intencao,
            respostaSugerida,
            estadoPercebido: estado,
            contextoEnviadoCount: tamanhoHistorico,
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
    limparLimitadores()
    chatHistory.clear()
  }
}

/**
 * Reprocessa a última mensagem do cliente ao abrir o chat.
 * Garante que `sugestoesPendentes`, `respostaSugerida` e perfil estejam atualizados
 * mesmo que a mensagem tenha sido processada antes da correção do código.
 *
 * Chamado pelo dashboard-module.ts quando o atendente muda de chat.
 */
export async function processarUltimaMensagem(chatId: string): Promise<boolean> {
  try {
    // Busca até 5 mensagens pra trás pra achar a última mensagem relevante do cliente
    const ultimas = await messageDB.getMessages(chatId, 5)
    let text = ''
    for (const msg of ultimas) {
      if (msg.isOutgoing) continue
      const t = (msg.text || '').trim()
      if (t.length >= 10) {
        text = t
        break
      }
    }
    if (!text) return false

    // Busca profile
    const profile = await customerProfileDB.getByChatId(chatId)

    // Se já tem sugestoesPendentes, não precisa reprocessar
    if (profile?.sugestoesPendentes?.length) return false

    // Busca candidatos do catálogo
    const catalogoCandidatos: string[] = []
    try {
      const accountId = catalogoDB.getCurrentUserWid() || 'default'
      const produtos = await catalogoDB.listByAccount(accountId)
      if (produtos.length > 0) {
        const matchNomes = produtos
          .filter(p => {
            const msgText = text.toLowerCase()
            const nome = p.nome.toLowerCase()
            const palavras = nome.split(/\s+/).filter((w: string) => w.length > 2)
            return palavras.some((palavra: string) => msgText.includes(palavra))
          })
          .slice(0, 5)
          .map(p => p.nome)
        catalogoCandidatos.push(...matchNomes)
      }
    } catch { /* catálogo indisponível */ }

    // ── Estado Percebido (reprocessamento) ──
    const estadoReprocess = await calcularEstadoPercebido(chatId, profile)
    const ringBufferReprocess = chatHistory.get(chatId) ?? []
    const tamanhoReprocess = decidirTamanhoHistorico(estadoReprocess, ringBufferReprocess.length)
    const historicoReprocess = tamanhoReprocess > 0
      ? ringBufferParaContexto(ringBufferReprocess, tamanhoReprocess, false)
      : undefined

    // Chama LLM
    const llmOutput = await ouvinteLlm({
      mensagem: text,
      chatId,
      profile,
      catalogoCandidatos,
      estadoPercebido: estadoReprocess,
      historicoContexto: historicoReprocess,
    })

    if (!llmOutput.usouLlm || Object.keys(llmOutput.extras).length === 0) return false

    const e = llmOutput.extras

    // Converte para sinais (mesma lógica do handler principal)
    const sinais: CustomerOperationalSignals = {}
    if (e.nome) sinais.nomeConfiavel = e.nome
    if (e.endereco) sinais.enderecoEntrega = e.endereco
    if (e.formaPagamento) sinais.formaPagamentoPreferida = [e.formaPagamento]
    if (e.urgencia) sinais.urgenciaEntrega = e.urgencia
    if (e.observacoesLogisticas?.length) sinais.observacoesLogisticas = e.observacoesLogisticas

    // Produtos com confiança alta/media → preferencias
    const produtosConfiaveis = e.produtos?.filter(p => p.confianca !== 'baixa' && p.nome !== 'desconhecido')
    if (produtosConfiaveis?.length) {
      sinais.preferenciasProduto = produtosConfiaveis.map(p => `${p.nome} (${p.quantidade}x)`)
    }
    // Produtos com confiança baixa → sugestoes pendentes
    const produtosBaixa = e.produtos?.filter(p => p.confianca === 'baixa' && p.nome !== 'desconhecido')
    if (produtosBaixa?.length) {
      const agora = new Date().toISOString()
      sinais.sugestoesPendentes = produtosBaixa.map(p => ({
        nome: p.nome,
        qtd: p.quantidade,
        nomeExtraido: p.nome,
        confianca: 'baixa' as const,
        metodo: 'llm' as const,
        evidencia: text,
        criadoEm: agora,
      }))
    }

    if (e.aversoes?.length) sinais.aversoesProduto = e.aversoes.map(a => a.nome)
    sinais.lastRecomputeReason = 'turn_end'
    sinais.lastRecomputeAtIso = new Date().toISOString()

    const result = await atualizarPerfilOperacionalCliente({ chatId, sinais })
    return result.ok
  } catch {
    return false
  }
}
