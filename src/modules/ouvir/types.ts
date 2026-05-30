import type { CustomerOperationalProfile } from '../../storage/customer-profile-db'

export type CampoConfianca = 'desconhecido' | 'baixa' | 'media' | 'alta'

export interface CampoExtraido {
  campo: string
  valor: string | string[]
  confianca: CampoConfianca
  fonte: string
  evidencias: string[]
}

export interface ExtratorInput {
  mensagem: string
  chatId: string
}

export interface ExtratorOutput {
  campos: CampoExtraido[]
  urgencia: 'alta' | 'media' | 'baixa'
  usaLLM: boolean
  camposRestantes: string[]
}

export interface CampoValidado {
  campo: string
  valor: string | string[]
  confiancaOriginal: CampoConfianca
  confiancaAjustada: number
  valido: boolean
  normalizado?: string
  fonte: string
  evidencias: string[]
  catalogoMatch?: {
    tipo: 'produto' | 'formaPagamento'
    itemId: string
  }
}

export interface ReleaseSignal {
  campo: string
  sinal: string
  novaConfiancaOriginal: CampoConfianca
  forca: 'RESET' | 'DOWNGRADE' | 'REPLACE'
  reextrair: boolean
}

export type TipoUpdate = 'memoria' | 'contexto_venda' | 'contexto_conversa' | 'feedback_atendente'

export interface DecisaoUpdate {
  campo: string
  tipo: TipoUpdate
  valor: string | string[] | undefined
  confianca: number
  prioridade: 'alta' | 'media' | 'baixa'
}

export interface ThrottleState {
  chatId: string
  timestamps: number[]
}

export interface CursorState {
  chatId: string
  ultimaMensagemProcessada: number
}

export interface LlmBudgetState {
  chatId: string
  data: string
  chamadasHoje: number
}

export interface OuvirProfileUpdatedEvent {
  chatId: string
  camposAtualizados: string[]
  confiancaPerfil: number
}

export interface LlmExtractionResult {
  produtos?: {
    nome: string
    quantidade: number
    confianca: 'alta' | 'media' | 'baixa'
  }[]
  nome?: string
  endereco?: string
  formaPagamento?: string
  urgencia?: 'alta' | 'normal' | 'baixa'
  observacoesLogisticas?: string[]
  aversoes?: {
    nome: string
    confianca: 'alta' | 'media' | 'baixa'
  }[]
  retratacoes?: string[]
}

export interface OuvinteLlmInput {
  mensagem: string
  chatId: string
  profile: CustomerOperationalProfile | null
  catalogoCandidatos: string[]
}

export interface OuvinteLlmOutput {
  extras: LlmExtractionResult
  usouLlm: boolean
  tokensEstimados: number
}
