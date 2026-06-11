/**
 * Tipos base do Agent Harness
 *
 * Interfaces: Tool, ToolCall, ToolResultado, AgentTurno, AgentStatus, Memoria, MemoriaTipo, MemoriaEscopo
 * Eventos: agent:turno-inicio, agent:tool-call, agent:tool-result, agent:resposta-pronta,
 *          agent:precisa-ferramenta, agent:erro
 *
 * Conforme SPEC.md da T-037 e ZenSpec agente-harness.
 */
import type { ZodType } from 'zod';
import type { EventBus } from '../../ui/core/event-bus';

// ── Tool ──

export interface Tool {
  nome: string;
  /** Descrição principal: quando usar + quando NÃO + exemplos */
  descricao: string;
  categoria: 'leitura' | 'escrita' | 'comunicacao' | 'acao';
  inputSchema: ZodType<unknown>;
  executar(input: unknown): Promise<ToolResultado>;
  soLeitura: boolean;
  precisaConfirmacao: boolean;
  quandoPrecisei?: string;
  criadaEm?: string;
  /** Opcional: dicas para o LLM sobre quando chamar esta tool */
  quandoUsar?: string;
  /** Opcional: dicas para o LLM sobre quando NÃO chamar */
  quandoNaoUsar?: string;
  /** Opcional: exemplos de uso (args → resultado) */
  exemplos?: string[];
}

export interface ToolCall {
  nome: string;
  argumentos: Record<string, unknown>;
  resultado: unknown;
  duracaoMs: number;
  erro?: string;
}

export interface ToolResultado {
  sucesso: boolean;
  dados?: unknown;
  erro?: string;
}

// ── Agent ──

export type AgentStatus = 'dormindo' | 'ativo' | 'pensando' | 'erro';

export interface AgentTurno {
  chatId: string;
  mensagemAtual: string;
  ferramentasChamadas: ToolCall[];
  status: AgentStatus;
  iniciadoEm: string;
}

// ── Memória (4 tipos taxonômicos, persistência IndexedDB) ──

export type MemoriaTipo = 'cliente' | 'licao' | 'negocio' | 'referencia';

/**
 * Registro de memória persistente.
 * - `cliente`: perfil, preferências, restrições (por chatId)
 * - `licao`: aprendizados de interações (por chatId)
 * - `negocio`: como o negócio opera (global)
 * - `referencia`: links, códigos, contatos externos (global)
 */
export interface Memoria {
  id?: number;
  tipo: MemoriaTipo;
  descricao: string;
  chatId?: string;
  dados?: unknown;
  criada_em: string;
  atualizada_em: string;
}

// ── Eventos agent:* ──

export interface AgentTurnoInicioEvent {
  chatId: string;
  mensagem: string;
  ferramentasDisponiveis: string[];
  /** Total de memórias carregadas para este turno */
  totalMemoriasCarregadas?: number;
  /** Informações resumidas do ambiente */
  envInfo?: {
    businessName: string;
    today: string;
  };
}

export interface AgentToolCallEvent {
  chatId: string;
  nome: string;
  argumentos: Record<string, unknown>;
  duracaoMs: number;
}

export interface AgentToolResultEvent {
  chatId: string;
  nome: string;
  resultado: ToolResultado;
}

export interface AgentRespostaProntaEvent {
  chatId: string;
  texto: string;
  ferramentasChamadas: ToolCall[];
}

export interface AgentPrecisaFerramentaEvent {
  chatId: string;
  nomeSugerido: string;
  descricao: string;
  entradaEsperada: Record<string, string>;
  saidaEsperada: Record<string, string>;
  porQuePreciso: string;
}

export interface AgentErroEvent {
  chatId: string;
  erro: string;
  gravidade: 'N1' | 'N2' | 'N3' | 'N4';
}

export interface AgentMemoriaSalvaEvent {
  chatId: string;
  memoriaId: number;
  tipo: 'licao' | 'cliente' | 'negocio' | 'referencia';
  descricao: string;
  ferramentasUsadas: string[];
  totalFerramentas: number;
  status: string;
  duracaoMs: number;
}

// ── ToolDescription (formato da API DeepSeek para function calling) ──

/**
 * Descrição de tool no formato da API DeepSeek/OpenAI.
 * Usado no body do request `/v1/chat/completions` no campo `tools`.
 */
export interface ToolDescription {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>  // JSON Schema
  }
}

// ── LlmToolResponse (resposta do motor-llm com suporte a tools) ──

/**
 * Resposta parseada do LLM quando há suporte a function calling.
 * Discriminated union com 3 variantes:
 * - `responder`: LLM respondeu com texto (sem tool call)
 * - `tool_use`: LLM decidiu chamar uma ferramenta
 * - `preciso_ferramenta`: LLM indicou que precisa de uma ferramenta que não existe
 */
export type LlmToolResponse =
  | { tipo: 'responder'; texto: string; erro?: string }
  | { tipo: 'tool_use'; nome: string; argumentos: Record<string, unknown> }
  | { tipo: 'preciso_ferramenta'; nomeSugerido: string; descricao: string; entradaEsperada: Record<string, string>; saidaEsperada: Record<string, string>; porQuePreciso: string }

// ── Event names (constantes para evitar typos) ──

export const AGENT_EVENTS = {
  TURNO_INICIO: 'agent:turno-inicio',
  TOOL_CALL: 'agent:tool-call',
  TOOL_RESULT: 'agent:tool-result',
  RESPOSTA_PRONTA: 'agent:resposta-pronta',
  PRECISA_FERRAMENTA: 'agent:precisa-ferramenta',
  ERRO: 'agent:erro',
  /** Memória persistida após um turno */
  MEMORIA_SALVA: 'agent:memoria-salva',
  /** Reservado para T-045 (compactação de contexto) */
  COMPACTING: 'agent:compacting',
} as const;

// ── MettriModule (para módulos sem UI, apenas init) ──

export interface MettriModule {
  id: string;
  init: (eventBus: EventBus) => Promise<() => void>;
}
