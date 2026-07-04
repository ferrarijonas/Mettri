import type { CustomerOperationalProfile } from '../../storage/customer-profile-db'

// ── Seções de prompt (arquivos .md locais no módulo) ──
// O esbuild resolve imports de .md como strings

import identidadePadaria from './prompts/identidade-padaria.md'
import tomDeVoz from './prompts/tom-de-voz.md'
import extracaoSistema from './prompts/extracao-sistema.md'
import confirmacaoCompra from './prompts/resposta-confirmacao.md'
import contextoConversa from './prompts/contexto-conversa.md'
import decisaoSistema from './prompts/decisao-sistema.md'

import sistemaMd from './prompts/sistema.md'
import modoAtendenteMd from './prompts/modo-atendente.md'

import type { EstadoPercebido, MensagemHistorico } from './types'
import type { ContextoMemorias } from '../harness/memory-store'
import type { EnvInfo } from '../harness/env-config'

export interface MontarPromptInput {
  /** Incluir seção de identidade (padaria + tom de voz) */
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

/** Monta os blocos <ambiente_negocio> e <ambiente_runtime> a partir do envInfo */
function gerarAmbiente(envInfo: EnvInfo, todayOverride?: string): string {
  const n = envInfo.negocio
  const r = envInfo.runtime
  const hoje = todayOverride ?? n.today ?? '(indisponível)'
  return [
    '<ambiente_negocio>',
    `businessName: ${n.businessName}`,
    `city: ${n.city}`,
    `timezone: ${n.timezone}`,
    `today: ${hoje}`,
    `horarioFuncionamento: ${n.horarioFuncionamento}`,
    '</ambiente_negocio>',
    '',
    '<ambiente_runtime>',
    `directory: ${r.directory}`,
    `modelName: ${r.modelName}`,
    `version: ${r.version}`,
    `platform: ${r.platform}`,
    '</ambiente_runtime>',
  ].join('\n')
}

/**
 * Monta o prompt do sistema a partir das seções solicitadas.
 *
 * System prompt (cacheável):
 *   1. "Você é a Mettri, atendente de IA para WhatsApp." (identidade do sistema)
 *   2. # Sistema — regras gerais
 *   3. # Modo Atendente — como pensar como atendente
 *   4. <ambiente> — dados da sessão (negócio, cidade, data)
 *   5. Persona + tom de voz
 *   6. Extração + Decisão (ferramentas)
 *
 * User prompt (dinâmico):
 *   DIRETRIZES DO NEGÓCIO + PREFERÊNCIAS DO CLIENTE + CONVERSA ATUAL
 */
export function montarPrompt(input: MontarPromptInput): MontarPromptOutput {
  // ── Linha de abertura: identidade do sistema Mettri ──
  const prefixoIdentidade = 'Você é a Mettri, atendente de IA para WhatsApp.'

  // ── Bloco <ambiente> (se fornecido) ──
  const ambienteBlock = input.envInfo ? gerarAmbiente(input.envInfo, input.today) : null

  // ── Seções registradas ──
  const secoes: Secao[] = [
    // Seções obrigatórias do core Mettri (sempre presentes)
    {
      id: 'sistema',
      ativo: true,
      conteudo: sistemaMd,
    },
    {
      id: 'modoAtendente',
      ativo: true,
      conteudo: modoAtendenteMd,
    },
    // Bloco <ambiente> (dinâmico)
    {
      id: 'ambiente',
      ativo: ambienteBlock !== null,
      conteudo: ambienteBlock ?? '',
    },
    // Seções modulares (controladas por flags)
    {
      id: 'identidade',
      ativo: input.identidade !== false,
      conteudo: `${identidadePadaria}\n${tomDeVoz}`,
    },
    {
      id: 'contextoConversa',
      ativo: input.contextoConversa === true,
      conteudo: contextoConversa,
    },
    {
      id: 'extracao',
      ativo: input.extracao !== false,
      conteudo: extracaoSistema,
    },
    {
      id: 'resposta',
      ativo: input.resposta === true,
      conteudo: confirmacaoCompra,
    },
    {
      id: 'decisao',
      ativo: input.decisao === true,
      conteudo: (input.tools?.length ? gerarSecaoTools(input.tools) : decisaoSistema),
    },
  ]

  // System prompt: prefixo + seções ativas (ordenadas)
  const corpo = secoes
    .filter(s => s.ativo)
    .map(s => s.conteudo.trim())
    .join('\n\n---\n\n')
  const systemPrompt = `${prefixoIdentidade}\n\n---\n\n${corpo}`

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

  // ── User Prompt: 3 seções com boundary explícito ──

  // Seção 1: DIRETRIZES DO NEGÓCIO
  const secoesUser: string[] = []

  if (input.memorias) {
    const m = input.memorias

    // Seção 1: Diretrizes do negócio (têm precedência)
    if (m.negocio.length > 0 || m.referencias.length > 0) {
      secoesUser.push(
        'DIRETRIZES DO NEGÓCIO (siga estritamente — têm precedência)',
      )
      for (const item of m.negocio) secoesUser.push(`• ${item}`)
      for (const item of m.referencias) secoesUser.push(`• ${item}`)
    }

    // Seção 2: Preferências do cliente
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

  // Seção final: CONVERSA ATUAL
  secoesUser.push('', 'CONVERSA ATUAL')

  const catalogoStatus = input.catalogoCandidatos.length > 0
    ? `Produtos disponíveis no catálogo: [${input.catalogoCandidatos.join(', ')}]`
    : 'Catálogo não disponível. Extraia produtos livremente do texto.'

  secoesUser.push(catalogoStatus, '---', JSON.stringify(userData))

  const userPrompt = secoesUser.join('\n')

  return { systemPrompt, userPrompt }
}
