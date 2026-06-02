import type { CustomerOperationalProfile } from '../../storage/customer-profile-db'

// ── Seções de prompt (arquivos .md locais no módulo) ──
// O esbuild resolve imports de .md como strings

import identidadePadaria from './prompts/identidade-padaria.md'
import tomDeVoz from './prompts/tom-de-voz.md'
import extracaoSistema from './prompts/extracao-sistema.md'
import confirmacaoCompra from './prompts/resposta-confirmacao.md'
import contextoConversa from './prompts/contexto-conversa.md'

import type { EstadoPercebido, MensagemHistorico } from './types'

export interface MontarPromptInput {
  /** Incluir seção de identidade (padaria + tom de voz) */
  identidade?: boolean
  /** Incluir seção de extração de perfil */
  extracao?: boolean
  /** Incluir seção de geração de resposta de confirmação */
  resposta?: boolean
  /** Incluir seção de contexto de conversa (adaptativo) */
  contextoConversa?: boolean
  /** Perfil do cliente para montar o user prompt (delta) */
  profile?: CustomerOperationalProfile | null
  /** Mensagem atual do cliente */
  mensagem: string
  /** Candidatos do catálogo (top 5) */
  catalogoCandidatos: string[]
  /** NOVO: Estado percebido do pedido */
  estadoPercebido?: EstadoPercebido
  /** NOVO: Histórico de mensagens para contexto (já filtrado pelo tamanho ideal) */
  historicoContexto?: MensagemHistorico[]
  /** NOVO: Intenção previamente classificada */
  intencaoAnterior?: string
}

export interface MontarPromptOutput {
  /** System prompt: seções estáticas (cacheável) */
  systemPrompt: string
  /** User prompt: dados dinâmicos (mensagem + catálogo + perfil) */
  userPrompt: string
}

// ── Seções registradas (estáticas, cacheáveis) ──

interface Secao {
  id: string
  ativo: boolean
  conteudo: string
}

/**
 * Monta o prompt do sistema a partir das seções solicitadas.
 *
 * Separação cacheável vs dinâmico:
 * - System prompt = identidade + regras de extração + resposta (não muda entre msgs)
 * - User prompt = mensagem + catálogo + perfil_atual (muda a cada chamada)
 *
 * Uso com DeepSeek:
 *   messages: [
 *     { role: "system", content: systemPrompt },
 *     { role: "user", content: userPrompt },
 *   ]
 */
export function montarPrompt(input: MontarPromptInput): MontarPromptOutput {
  const secoes: Secao[] = [
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
  ]

  // System prompt: concatena seções ativas
  const systemPrompt = secoes
    .filter(s => s.ativo)
    .map(s => s.conteudo.trim())
    .join('\n\n---\n\n')

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

  const catalogoStatus = input.catalogoCandidatos.length > 0
    ? `Produtos disponíveis no catálogo: [${input.catalogoCandidatos.join(', ')}]`
    : 'Catálogo não disponível. Extraia produtos livremente do texto.'

  const userPrompt = [
    catalogoStatus,
    '---',
    JSON.stringify(userData),
  ].join('\n')

  return { systemPrompt, userPrompt }
}
