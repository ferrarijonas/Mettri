import type { CustomerOperationalProfile } from '../../storage/customer-profile-db'

// ── Seções de prompt (arquivos .md locais no módulo) ──
// O esbuild resolve imports de .md como strings

import tomDeVoz from './prompts/tom-de-voz.md'
import extracaoSistema from './prompts/extracao-sistema.md'
import confirmacaoCompra from './prompts/resposta-confirmacao.md'
import contextoConversa from './prompts/contexto-conversa.md'
import decisaoSistema from './prompts/decisao-sistema.md'

import sistemaMd from './prompts/sistema.md'
import metodoMd from './prompts/metodo.md'

import type { EstadoPercebido, MensagemHistorico } from './types'
import type { ContextoMemorias } from '../harness/memory-store'
import type { EnvInfo, AmbienteNegocio, AmbienteRuntime } from '../harness/env-config'

// ── SOUL — identidade fixa do sistema (sempre ativa) ──
const SECAO_SOUL = 'Você é a Mettri, plataforma de vendas e gestão para pequenos negócios.'

export interface MontarPromptInput {
  /** Incluir seção de tom de voz (antiga identidade) */
  identidade?: boolean
  /** Incluir seção de extração de perfil */
  extracao?: boolean
  /** Incluir seção de geração de resposta de confirmação */
  resposta?: boolean
  /** Incluir seção de decisão de ferramentas (tool-use instructions) */
  decisao?: boolean
  /** Incluir seção de contexto de conversa (adaptativo) */
  contextoConversa?: boolean
  /** Perfil do cliente para montar o user prompt (delta) */
  profile?: CustomerOperationalProfile | null
  /** Causa do despertar (para bloco <despertar> no user prompt) */
  causa?: 'mensagem_recebida' | 'reativacao' | 'continuar_turno'
  /** Skill ativa no momento */
  skillAtiva?: string
  /** Mensagem atual do cliente */
  mensagem: string
  /** Candidatos do catálogo (top 5) */
  catalogoCandidatos: string[]
  /** Estado percebido do pedido */
  estadoPercebido?: EstadoPercebido
  /** Histórico de mensagens para contexto */
  historicoContexto?: MensagemHistorico[]
  /** Intenção previamente classificada */
  intencaoAnterior?: string
  /** Chat ID do cliente (necessário para tools que precisam preencher chatId) */
  chatId?: string
  /** Memórias persistentes para contexto (4 tipos taxonômicos) */
  memorias?: ContextoMemorias
  /** Informações de ambiente (data, cidade, negócio, modelo) */
  envInfo?: EnvInfo
  /** Data formatada para exibição no bloco <ambiente> */
  today?: string
  /** Ferramentas disponíveis para gerar seção de decisão dinâmica */
  tools?: { nome: string; descricao: string; categoria: string }[]
}

export interface MontarPromptOutput {
  /** System prompt: seções estáticas (cacheável) */
  systemPrompt: string
  /** User prompt: dados dinâmicos (mensagem + catálogo + perfil) */
  userPrompt: string
}

// ── PROPÓSITO — derivado das categorias das tools disponíveis ──
function construirProposito(tiposDisponiveis: string[]): string {
  const mapa: Record<string, string> = {
    leitura: 'vendas',
    escrita: 'vendas',
    pesquisa: 'vendas',
    execucao: 'entrega',
    delegacao: 'gestão',
  }
  const areas = [...new Set(tiposDisponiveis.map(t => mapa[t] || 'vendas').filter(Boolean))]
  return `Você é um atendente que ajuda com ${areas.join(' e ')} do negócio.`
}

// ── DESPERTAR — bloco contextual no user prompt ──
type CustomerProfileWithMeta = CustomerOperationalProfile & {
  ultimaMensagem?: string
  totalPedidos?: number
}

function gerarDespertar(params: {
  causa: string
  profile?: CustomerOperationalProfile | null
  memorias?: ContextoMemorias
  skillAtiva?: string
  today?: string
}): string {
  const profile = params.profile as CustomerProfileWithMeta | null | undefined
  const diasInativo = profile?.ultimaMensagem
    ? Math.floor((Date.now() - new Date(profile.ultimaMensagem).getTime()) / 86400000)
    : 0
  return [
    '<despertar>',
    `causa: ${params.causa}`,
    `nome: ${profile?.nomeConfiavel ?? 'desconhecido'}`,
    `dias_inativo: ${diasInativo}`,
    `total_pedidos: ${profile?.totalPedidos ?? 0}`,
    params.skillAtiva ? `skill_ativa: ${params.skillAtiva}` : null,
    params.memorias ? `memorias_carregadas: ${Object.values(params.memorias).flat().length}` : null,
    '</despertar>',
  ].filter(Boolean).join('\n')
}

function gerarSecaoTools(tools: { nome: string; descricao: string; categoria: string }[]): string {
  return [
    'Com base na mensagem do cliente e nas ferramentas disponíveis, decida qual chamar ou responda diretamente.',
    '',
    'FERRAMENTAS DISPONÍVEIS:',
    ...tools.map(t => `  • ${t.nome} (${t.categoria}): ${t.descricao}`),
    '',
    'REGRAS:',
    '  - Ferramentas de LEITURA → pode chamar sem confirmar',
    '  - Ferramentas de ESCRITA → confirme com o cliente antes',
    '  - Se uma ferramenta retornar erro, corrija e tente 1 vez, depois responda com o que sabe',
    '  - Após usar as ferramentas necessárias, RESPONDA o cliente',
    '',
    'RESPOSTA DIRETA:',
    '  - Seja natural e humano, como Jonas da padaria',
    '  - NUNCA inclua JSON, metadados, intenções ou justificativas na sua resposta',
    '  - Responda APENAS o texto que o cliente vai ler',
    '',
    'COMO EVITAR CICLOS:',
    '  - 2 a 3 tools por turno é suficiente na maioria dos casos',
    '  - Se passou de 5 tools, responda imediatamente',
    '  - Não alterne entre ferramentas sem propósito',
  ].join('\n')
}

interface Secao {
  id: string
  ativo: boolean
  conteudo: string
}

/** Bloco <ambiente_negocio> com dados do negócio */
function gerarAmbienteNegocio(negocio: AmbienteNegocio, today?: string): string {
  const hoje = today ?? '(indisponível)'
  return [
    '<ambiente_negocio>',
    `Negócio: ${negocio.businessName}`,
    `Cidade: ${negocio.city}`,
    `Fuso: ${negocio.timezone}`,
    `Hoje: ${hoje}`,
    `Horário: ${negocio.horarioFuncionamento}`,
    '</ambiente_negocio>',
  ].join('\n')
}

/** Bloco <ambiente_runtime> com dados de runtime */
function gerarAmbienteRuntime(runtime: AmbienteRuntime): string {
  return [
    '<ambiente_runtime>',
    `Diretório: ${runtime.directory}`,
    `Modelo: ${runtime.modelName}`,
    `Versão: ${runtime.version}`,
    `Plataforma: ${runtime.platform}`,
    '</ambiente_runtime>',
  ].join('\n')
}

/**
 * Monta o prompt do sistema a partir das seções solicitadas.
 *
 * System prompt (cacheável):
 *   1. SOUL — identidade fixa do sistema
 *   2. PROPÓSITO — derivado das tools disponíveis
 *   3. # Sistema — regras gerais
 *   4. <ambiente_negocio> + <ambiente_runtime> — dados da sessão
 *   5. # Método — modo atendente
 *   6. Tom de voz
 *   7. Contexto de conversa (se ativo)
 *   8. Extração (se ativo)
 *   9. Resposta (se ativo)
 *   10. DECISÃO (ferramentas)
 *
 * User prompt (dinâmico):
 *   <despertar> + DIRETRIZES DO NEGÓCIO + PREFERÊNCIAS DO CLIENTE + CONVERSA ATUAL
 */
export function montarPrompt(input: MontarPromptInput): MontarPromptOutput {
  // ── SOUL + PROPÓSITO ──
  const soul = SECAO_SOUL
  const tipos = input.tools?.map(t => t.categoria) ?? []
  const proposito = construirProposito(tipos)

  // ── Bloco <ambiente> (se fornecido) ──
  const ambienteBlock = input.envInfo
    ? `${gerarAmbienteNegocio(input.envInfo.negocio, input.today)}\n\n${gerarAmbienteRuntime(input.envInfo.runtime)}`
    : null

  // ── Seções registradas (ordem: SOUL → PROPÓSITO → SISTEMA → AMBIENTE → MÉTODO → TOM → contextoConversa → extracao → resposta → DECISÃO) ──
  const secoes: Secao[] = [
    // 1. SOUL
    { id: 'soul', ativo: true, conteudo: soul },
    // 2. PROPÓSITO
    { id: 'proposito', ativo: true, conteudo: proposito },
    // 3. SISTEMA
    { id: 'sistema', ativo: true, conteudo: sistemaMd },
    // 4. AMBIENTE (ambiente_negocio + ambiente_runtime)
    { id: 'ambiente', ativo: ambienteBlock !== null, conteudo: ambienteBlock ?? '' },
    // 5. MÉTODO (metodo.md — funil 7 etapas universal)
    { id: 'metodo', ativo: true, conteudo: metodoMd },
    // 6. TOM (tom de voz)
    { id: 'tom', ativo: input.identidade !== false, conteudo: tomDeVoz },
    // 7. Contexto de conversa
    { id: 'contextoConversa', ativo: input.contextoConversa === true, conteudo: contextoConversa },
    // 8. Extração
    { id: 'extracao', ativo: input.extracao !== false, conteudo: extracaoSistema },
    // 9. Resposta
    { id: 'resposta', ativo: input.resposta === true, conteudo: confirmacaoCompra },
    // 10. DECISÃO
    { id: 'decisao', ativo: input.decisao === true, conteudo: (input.tools?.length ? gerarSecaoTools(input.tools) : decisaoSistema) },
  ]

  // System prompt: seções ativas (ordenadas)
  const systemPrompt = secoes
    .filter(s => s.ativo)
    .map(s => s.conteudo.trim())
    .join('\n\n---\n\n')

  // ── DESPERTAR (bloco contextual no user prompt) ──
  const despertarBlock = input.causa ? gerarDespertar({
    causa: input.causa,
    profile: input.profile,
    memorias: input.memorias,
    skillAtiva: input.skillAtiva,
    today: input.today,
  }) : null

  // User prompt: monta o JSON com dados dinâmicos
  const perfilVazio: Record<string, null> = {}
  const p = input.profile
  if (p) {
    if (!p.nomeConfiavel) perfilVazio.nome = null
    if (!p.enderecoEntrega) perfilVazio.endereco = null
    if (!p.formaPagamentoPreferida || p.formaPagamentoPreferida.length === 0) {
      perfilVazio.formaPagamento = null
    }
  }

  // Campos dinâmicos do user prompt
  const userData: Record<string, unknown> = {
    mensagem: input.mensagem,
    catalogo: input.catalogoCandidatos,
    perfil_atual: perfilVazio,
  }

  // Adiciona histórico de contexto se fornecido
  if (input.historicoContexto && input.historicoContexto.length > 0) {
    userData.historico_recente = input.historicoContexto.map(h => ({
      papel: h.papel,
      texto: h.texto,
    }))
  }

  // Adiciona estado percebido se fornecido
  if (input.estadoPercebido) {
    userData.estado_percebido = {
      fase: input.estadoPercebido.fase,
      coletado: input.estadoPercebido.coletado,
      confianca: input.estadoPercebido.confiancaEstado,
    }
  }

  // Adiciona intenção anterior se fornecida
  if (input.intencaoAnterior) {
    userData.intencao_anterior = input.intencaoAnterior
  }

  // Adiciona chatId se seção de decisão estiver ativa (necessário para tools)
  if (input.decisao && input.chatId) {
    userData.chat_id = input.chatId
  }

  // ── User Prompt ──
  const secoesUser: string[] = []

  // Bloco DESPERTAR (se causa fornecida)
  if (despertarBlock) secoesUser.push(despertarBlock)

  if (input.memorias) {
    const m = input.memorias

    // Diretrizes do negócio (têm precedência)
    if (m.negocio.length > 0 || m.referencias.length > 0) {
      secoesUser.push(
        'DIRETRIZES DO NEGÓCIO (siga estritamente — têm precedência)',
      )
      for (const item of m.negocio) secoesUser.push(`• ${item}`)
      for (const item of m.referencias) secoesUser.push(`• ${item}`)
    }

    // Preferências do cliente
    if (m.cliente.length > 0 || m.licoes.length > 0) {
      secoesUser.push('', 'PREFERÊNCIAS DO CLIENTE')
      for (const item of m.cliente) secoesUser.push(`• ${item}`)
      for (const item of m.licoes) secoesUser.push(`• ${item}`)
    }

    // Freshness warnings (se houver)
    if (m.freshnessWarnings.length > 0) {
      secoesUser.push('', ...m.freshnessWarnings)
    }
  }

  // CONVERSA ATUAL
  secoesUser.push('', 'CONVERSA ATUAL')

  const catalogoStatus = input.catalogoCandidatos.length > 0
    ? `Produtos disponíveis no catálogo: [${input.catalogoCandidatos.join(', ')}]`
    : 'Catálogo não disponível. Extraia produtos livremente do texto.'

  secoesUser.push(catalogoStatus, '---', JSON.stringify(userData))

  const userPrompt = secoesUser.join('\n')

  return { systemPrompt, userPrompt }
}
