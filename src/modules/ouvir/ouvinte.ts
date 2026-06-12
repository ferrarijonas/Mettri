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
import type { OuvirProfileUpdatedEvent, OuvirStateEstimatedEvent, EstadoPercebido, MensagemHistorico } from './types'
import { memoryStore } from '../harness/memory-store'
import { AGENT_EVENTS } from '../harness/types'

/** Ring buffer: �ltimas 10 mensagens por chatId (ambas dire��es). */
const chatHistory = new Map<string, { text: string; isOutgoing: boolean }[]>()

/** Contador de turnos consecutivos com confian�a baixa por chatId */
const turnosBaixaConfianca = new Map<string, number>()

/** �ltima inten��o classificada por chatId */
const ultimaIntencaoPorChat = new Map<string, string>()

/** Flag: inten��o mudou no turno anterior (expande hist�rico no pr�ximo turno) */
const intentChangedFlag = new Map<string, boolean>()

/** ChatId atualmente ativo (sendo visualizado pelo atendente). null se nenhum. */
let activeChatId: string | null = null

/** Flag: true depois do primeiro chat:active-changed. O primeiro evento � do ActiveChatService (autom�tico), ignoramos. */
let firstActiveEventReceived = false

function pushHistory(chatId: string, text: string, isOutgoing: boolean): void {
  const hist = chatHistory.get(chatId) || []
  hist.push({ text, isOutgoing })
  if (hist.length > 10) hist.shift()
  chatHistory.set(chatId, hist)
}

// -- Estado Percebido --

/**
 * Calcula o EstadoPercebido a partir do perfil operacional e dos pedidos ativos.
 * Consulta orderDB para determinar a fase do pedido.
 */
/**
 * Tenta obter clientKey a partir de um profile.
 * CustomerOperationalProfile n�o tem clientKey no schema,
 * mas alguns registros podem ter via passthrough.
 * Fallback: retorna chatId para busca heur�stica.
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
 * Usa o perfil para determinar fase, confian�a e o que j� foi coletado.
 * A consulta ao orderDB � feita via clientKey se dispon�vel, sen�o usa heur�stica.
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
      // Mesmo sem clientKey, se inten��o � p�s-venda, assumimos p�s-venda
      fase = 'pos_venda'
    }

    // Confian�a: se tem pedido ativo E produtos ? alta
    // Se tem um dos dois ? media
    // Nenhum ? baixa
    const temPedidoEmAberto = temPedidoAtivo && fase !== 'completed' && fase !== 'pos_venda'
    if (temPedidoEmAberto && temProdutos) {
      confiancaEstado = 'alta'
    } else if (temPedidoEmAberto || temProdutos) {
      confiancaEstado = 'media'
    } else {
      confiancaEstado = 'baixa'
    }

    // Se est� em p�s-venda, confian�a � media (contexto pode ser necess�rio)
    if (fase === 'pos_venda') {
      confiancaEstado = 'media'
    }

    // precisaContextoExtra: se confian�a baixa por 2+ turnos consecutivos
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

/** Decide a quantidade de mensagens de hist�rico a enviar baseado no EstadoPercebido. */
function decidirTamanhoHistorico(
  estado: EstadoPercebido,
  ringBufferSize: number,
  intentChanged?: boolean,
  produtoConfiancaBaixa?: boolean,
): number {
  if (ringBufferSize === 0) return 0 // Primeira mensagem

  // Tabela de estrat�gia � usa Math.max para combinar condi��es sobrepostas
  let tamanho = 1
  if (estado.precisaContextoExtra) tamanho = Math.max(tamanho, 15)
  if (estado.confiancaEstado === 'baixa') tamanho = Math.max(tamanho, 10)
  if (intentChanged) tamanho = Math.max(tamanho, 8)
  if (produtoConfiancaBaixa) tamanho = Math.max(tamanho, 6)
  if (estado.confiancaEstado === 'media') tamanho = Math.max(tamanho, 5)
  // confianca 'alta' ou fallback ? 1 (j� � o valor padr�o)

  return Math.min(tamanho, ringBufferSize)
}

/** Converte ring buffer para MensagemHistorico (formato do prompt). */
function ringBufferParaContexto(
  hist: { text: string; isOutgoing: boolean }[],
  tamanho: number,
  incluirUltima?: boolean,
): MensagemHistorico[] {
  const slice = hist.slice(-tamanho)
  // Se incluirUltima for false e o tamanho for > 1, remove a �ltima (que � a msg atual)
  const msgs = incluirUltima === false && slice.length > 1 ? slice.slice(0, -1) : slice
  return msgs.map(h => ({
    papel: h.isOutgoing ? 'atendente' as const : 'cliente' as const,
    texto: h.text,
  }))
}

// -- Registro de listeners --

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

        // Atualiza ring buffer com TODAS as mensagens (inclusive outgoing)
        // mant�m buffer quente mesmo para chats inativos (pushHistory antes do filtro)
        pushHistory(chatId, text, msg.isOutgoing)

        // S� processa pipeline se houver chat ativo (clicado pelo atendente) E for o chat certo
        // activeChatId === null significa "n�o processar nada at� clique"
        if (activeChatId === null || chatId !== activeChatId) {
          if (activeChatId !== null) console.log('[ouvinte] pulando (chat inativo)')
          return
        }

        // Emite evento de processamento IMEDIATAMENTE (antes do throttle/LLM)
        // para o dashboard mostrar um skeleton/bloco vazio sem delay
        eventBus.emit('ouvir:processing', {
          chatId,
          startedAtIso: new Date().toISOString(),
        } satisfies import('./types').OuvirProcessingEvent)

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

        // Busca candidatos do cat�logo diretamente do banco local
        const catalogoCandidatos: string[] = []
        try {
          const accountId = catalogoDB.getCurrentUserWid() || 'default'
          const produtos = await catalogoDB.listByAccount(accountId)
          if (produtos.length > 0) {
            const matchNomes = produtos
              .filter(p => {
                const msg = text.toLowerCase()
                const nome = p.nome.toLowerCase()
                // Match se QUALQUER palavra do nome (=3 chars) aparece na mensagem
                // Ex: msg="multigr�os" matcha com nome "P�o Multigr�os" via "multigr�os"
                const palavras = nome.split(/\s+/).filter(w => w.length > 2)
                return palavras.some(palavra => msg.includes(palavra))
              })
              .slice(0, 5)
              .map(p => p.nome)
            catalogoCandidatos.push(...matchNomes)
          }
        } catch {
          // Cat�logo indispon�vel � LLM extrai livremente
        }

        console.log('[ouvinte-llm] input:', {
          mensagem: text,
          chatId: chatId.substring(0, 20),
          profileTemDados: !!profile?.nomeConfiavel,
          catalogoCandidatos,
        })

        // -- Estado Percebido --
        const intencaoAnterior = ultimaIntencaoPorChat.get(chatId)
        const estado = await calcularEstadoPercebido(chatId, profile, intencaoAnterior)

        // Emite evento de estado estimado (ZenSpec se��o 10.1)
        const ringBuffer = chatHistory.get(chatId) ?? []
        eventBus.emit('ouvir:state-estimated', {
          chatId,
          estado,
          historicoContextoCount: ringBuffer.length,
        } satisfies OuvirStateEstimatedEvent)

        // -- Tamanho do hist�rico --
        const intentChanged = intentChangedFlag.get(chatId) ?? false
        if (intentChanged) intentChangedFlag.delete(chatId)
        const produtoConfiancaBaixa = !!profile?.sugestoesPendentes?.length
        const tamanhoHistorico = decidirTamanhoHistorico(estado, ringBuffer.length, intentChanged, produtoConfiancaBaixa)
        const historicoContexto = tamanhoHistorico > 0
          ? ringBufferParaContexto(ringBuffer, tamanhoHistorico, false)
          : undefined

        // Atualiza contador de turnos de baixa confian�a
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

        // Se a API retornou erro, emite evento para o inspector
        if (llmOutput.erro) {
          eventBus.emit(AGENT_EVENTS.ERRO, {
            chatId,
            erro: llmOutput.erro,
            gravidade: 'N4' as const,
          })
        }

        // Atualiza inten��o anterior para o pr�ximo turno
        if (llmOutput.extras.intencao) {
          ultimaIntencaoPorChat.set(chatId, llmOutput.extras.intencao)
          // Se inten��o mudou, marca flag para expandir hist�rico no PR�XIMO turno
          if (intencaoAnterior && llmOutput.extras.intencao !== intencaoAnterior) {
            intentChangedFlag.set(chatId, true)
          }
        }

        if (!llmOutput.usouLlm || Object.keys(llmOutput.extras).length === 0) {
          console.log('[ouvinte-llm] sem extra��o, pulando')
          return
        }

        // Converte LlmExtractionResult ? CustomerOperationalSignals
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
          // Produtos com confian�a alta/media ? prefer�ncias (persiste)
          const produtosConfiaveis = e.produtos.filter(p => p.confianca !== 'baixa' && p.nome !== 'desconhecido')
          if (produtosConfiaveis.length > 0) {
            sinais.preferenciasProduto = produtosConfiaveis.map(p => `${p.nome} (${p.quantidade}x)`)
          }
          // Produtos com confian�a baixa ? sugest�o pendente (atendente decide)
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
        // retratacoes n�o vira campo no perfil � sinaliza pro merge.
        // Se houver retrata��o, o atualizarPerfilOperacionalCliente
        // j� lida com conflitos via pendentesConfirmacao.
        sinais.lastRecomputeReason = 'turn_end'
        sinais.lastRecomputeAtIso = new Date().toISOString()

        console.log('[ouvinte-llm] persistindo:', sinais)

        const result = await atualizarPerfilOperacionalCliente({ chatId, sinais })
        console.log('[ouvinte-llm] persist�ncia:', result.ok ? 'sim' : 'nao', result.ok ? '' : (result as unknown as { message: string }).message)

        if (result.ok) {
          const camposAtualizados = Object.keys(sinais)
            .filter(k => k !== 'lastRecomputeReason' && k !== 'lastRecomputeAtIso')

          // Se o LLM classificou a inten��o ou gerou resposta, propaga no evento
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

          // Dispara o Agent Harness quando uma inten��o � extra�da com sucesso
          // Passa contexto rico (profile, cat�logo, estado, hist�rico, mem�rias) para o agente
          // Busca mem�rias persistentes para enriquecer o contexto do LLM
          // Degrada��o graciosa: se falhar, contexto segue sem mem�rias
          const memorias = await memoryStore.prepararContexto(chatId, text).catch(() => undefined)
          const mettriHarness = (window as unknown as Record<string, unknown>).__mettriHarness as
            | { loop: { processarMensagem: (chatId: string, msg: string, context?: Record<string, unknown>) => Promise<void> } }
            | undefined
          if (intencao && mettriHarness?.loop) {
            console.log('[ouvinte] disparando AgentLoop para:', chatId.substring(0, 20), text.substring(0, 40))
            mettriHarness.loop.processarMensagem(chatId, text, {
              profile,
              catalogoCandidatos,
              estadoPercebido: estado,
              historicoContexto,
              memorias,
            }).catch((err: unknown) => {
              console.error('[ouvinte] AgentLoop error:', err)
            })
          }
        }
      } catch (error) {
        console.error('[ouvinte] Erro no pipeline:', error)
      }
    })()
  }

  eventBus.on('chat:active-changed', (data: { chatId?: unknown }) => {
    // Primeiro evento � do ActiveChatService detectando automaticamente no load � ignorar.
    // S� chats clicados manualmente disparam processing.
    if (!firstActiveEventReceived) {
      firstActiveEventReceived = true
      activeChatId = null
      return
    }
    const chatId = typeof data?.chatId === 'string' ? data.chatId : null
    activeChatId = chatId
    // Dispara reprocessamento do chat clicado, independente do dashboard module
    if (chatId) {
      processarUltimaMensagem(chatId, eventBus).catch(() => {})
    }
  })

  eventBus.on('message:new', handler)

  // Intercepta clique do usuário nos chats do WhatsApp (via DOM)
  // ActiveChatService não emite evento quando clica no mesmo chat — esta é a garantia
  // de que todo clique manual dispara processamento.
  function onChatListClick(e: MouseEvent): void {
    // Tenta múltiplos seletores de chat row (WA Web muda com versões)
    const chatRow = (e.target as HTMLElement)
      ?.closest('[role="row"], [role="option"], [data-testid*="cell-frame"]')
    if (!chatRow) return

    // Estratégia 1: Mettri interceptors (acesso direto aos módulos WA)
    try {
      const mettri = (window as unknown as Record<string, unknown>).Mettri as
        | { Chat?: { getActive?: () => { id?: { _serialized?: string } | string } | null } }
        | undefined
      if (mettri?.Chat?.getActive) {
        // Pequeno delay para o WhatsApp atualizar o estado interno após o clique
        setTimeout(() => {
          try {
            const active = mettri.Chat!.getActive!()
            const rawId = active?.id
            const chatId = typeof rawId === 'string' ? rawId : rawId?._serialized
            if (chatId && chatId !== activeChatId) {
              activeChatId = chatId
              console.log('[ouvinte] clique detectado (mettri):', chatId.substring(0, 25))
              processarUltimaMensagem(chatId, eventBus).catch(() => {})
            }
          } catch { /* silencioso */ }
        }, 150)
        return
      }
    } catch { /* Mettri não disponível */ }

    // Estratégia 2 (fallback): Store do WhatsApp (versões antigas)
    try {
      const titleEl = chatRow.querySelector('[title]')
      const title = titleEl?.getAttribute('title') || ''
      const store = (window as unknown as Record<string, unknown>).Store as
        | { Chat?: { getModelsArray?: () => Record<string, unknown>[] } }
        | undefined
      if (store?.Chat && typeof store.Chat.getModelsArray === 'function') {
        const allChats = store.Chat.getModelsArray()
        for (const chat of allChats) {
          const name = (chat as Record<string, unknown>).name as string | undefined
            || (chat as Record<string, unknown>).formattedTitle as string | undefined
          if (name === title) {
            const rawId = (chat as Record<string, unknown>).id as { _serialized?: string } | string | undefined
            const chatId = typeof rawId === 'string' ? rawId : rawId?._serialized
            if (chatId) {
              activeChatId = chatId
              console.log('[ouvinte] clique detectado em:', name, '(' + chatId.substring(0, 20) + ')')
              processarUltimaMensagem(chatId, eventBus).catch(() => {})
            }
            break
          }
        }
      }
    } catch { /* Store não disponível */ }
  }

  // Usa event delegation no document para capturar cliques em chats
  document.addEventListener('click', onChatListClick, true)

  return () => {
    eventBus.off('message:new', handler)
    limparLimitadores()
    chatHistory.clear()
    activeChatId = null
    document.removeEventListener('click', onChatListClick, true)
  }
}

/**
 * Reprocessa a �ltima mensagem do cliente ao abrir o chat.
 * Garante que `sugestoesPendentes`, `respostaSugerida` e perfil estejam atualizados
 * mesmo que a mensagem tenha sido processada antes da corre��o do c�digo.
 *
 * Chamado pelo dashboard-module.ts quando o atendente muda de chat.
 */
export async function processarUltimaMensagem(
  chatId: string,
  eventBus?: EventBus,
): Promise<boolean> {
  try {
    // Carrega �ltimas 30 mensagens pra popular o ring buffer e dar contexto ao LLM
    const ultimas = await messageDB.getMessages(chatId, 30)
    if (ultimas.length === 0) return false

    // Popula ring buffer com todas as mensagens carregadas (ambas dire��es)
    // para que ouvinteLlm tenha hist�rico de conversa completo
    for (const m of ultimas) {
      pushHistory(chatId, (m.text || '').trim(), m.isOutgoing)
    }

    // Acha a �ltima mensagem do cliente com texto suficiente
    let text = ''
    for (let i = ultimas.length - 1; i >= 0; i--) {
      const msg = ultimas[i]
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

    // Se j� tem sugestoesPendentes, n�o precisa reprocessar
    if (profile?.sugestoesPendentes?.length) return false

    // Busca candidatos do cat�logo (match com TODAS as mensagens do cliente, n�o s� a �ltima)
    const catalogoCandidatos: string[] = []
    try {
      const accountId = catalogoDB.getCurrentUserWid() || 'default'
      const produtos = await catalogoDB.listByAccount(accountId)
      if (produtos.length > 0) {
        const allClientTexts = ultimas
          .filter(m => !m.isOutgoing)
          .map(m => (m.text || '').toLowerCase())
          .join(' ')
        const matchNomes = produtos
          .filter(p => {
            const nome = p.nome.toLowerCase()
            const palavras = nome.split(/\s+/).filter(w => w.length > 2)
            return palavras.some(palavra => allClientTexts.includes(palavra))
          })
          .slice(0, 5)
          .map(p => p.nome)
        catalogoCandidatos.push(...matchNomes)
      }
    } catch { /* cat�logo indispon�vel */ }

    // -- Estado Percebido (reprocessamento) --
    const estadoReprocess = await calcularEstadoPercebido(chatId, profile)
    const ringBufferReprocess = chatHistory.get(chatId) ?? []
    const tamanhoReprocess = decidirTamanhoHistorico(estadoReprocess, ringBufferReprocess.length)
    const historicoReprocess = tamanhoReprocess > 0
      ? ringBufferParaContexto(ringBufferReprocess, tamanhoReprocess, false)
      : undefined

    console.log('[ouvinte] reprocessando chat:', chatId.substring(0, 20),
      '| msgs carregadas:', ultimas.length,
      '| buffer:', ringBufferReprocess.length,
      '| hist�rico enviado:', tamanhoReprocess)

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

    // Converte para sinais (mesma l�gica do handler principal)
    const sinais: CustomerOperationalSignals = {}
    if (e.nome) sinais.nomeConfiavel = e.nome
    if (e.endereco) sinais.enderecoEntrega = e.endereco
    if (e.formaPagamento) sinais.formaPagamentoPreferida = [e.formaPagamento]
    if (e.urgencia) sinais.urgenciaEntrega = e.urgencia
    if (e.observacoesLogisticas?.length) sinais.observacoesLogisticas = e.observacoesLogisticas

    // Produtos com confian�a alta/media ? preferencias
    const produtosConfiaveis = e.produtos?.filter(p => p.confianca !== 'baixa' && p.nome !== 'desconhecido')
    if (produtosConfiaveis?.length) {
      sinais.preferenciasProduto = produtosConfiaveis.map(p => `${p.nome} (${p.quantidade}x)`)
    }
    // Produtos com confian�a baixa ? sugestoes pendentes
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

    if (result.ok && eventBus) {
      const camposAtualizados = Object.keys(sinais)
        .filter(k => k !== 'lastRecomputeReason' && k !== 'lastRecomputeAtIso')

      eventBus.emit('ouvir:profile-updated', {
        chatId,
        camposAtualizados,
        confiancaPerfil: result.data?.confiancaPerfil ?? 0,
        intencao: e.intencao,
        respostaSugerida: e.respostaSugerida,
        estadoPercebido: estadoReprocess,
        contextoEnviadoCount: tamanhoReprocess,
      } satisfies OuvirProfileUpdatedEvent)

      // Dispara Agent Loop se houver inten��o relevante
      const intencao = e.intencao
      if (intencao && intencao !== 'outro') {
        const memorias = await memoryStore.prepararContexto(chatId, text).catch(() => undefined)
        const harness = (window as unknown as Record<string, unknown>).__mettriHarness as
          | { loop: { processarMensagem: (chatId: string, msg: string, context?: Record<string, unknown>) => Promise<void> } }
          | undefined
        if (harness?.loop) {
          console.log('[ouvinte] disparando AgentLoop (reprocessamento):', chatId.substring(0, 20), text.substring(0, 40))
          harness.loop.processarMensagem(chatId, text, {
            profile,
            catalogoCandidatos,
            estadoPercebido: estadoReprocess,
            historicoContexto: historicoReprocess,
            memorias,
          }).catch((err: unknown) => {
            console.error('[ouvinte] AgentLoop error (reprocessamento):', err)
          })
        }
      }
    }

    return result.ok
  } catch {
    return false
  }
}

