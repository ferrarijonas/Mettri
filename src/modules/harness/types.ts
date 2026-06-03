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
  descricao: string;
  categoria: 'leitura' | 'escrita' | 'comunicacao' | 'acao';
  inputSchema: ZodType<unknown>;
  executar(input: unknown): Promise<ToolResultado>;
  soLeitura: boolean;
  precisaConfirmacao: boolean;
  quandoPrecisei?: string;
  criadaEm?: string;
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

// ── Memória (esqueleto, sem persistência ainda) ──

export type MemoriaTipo = 'cliente' | 'feedback' | 'conversa' | 'regra';

export type MemoriaEscopo = 'global' | `chat:${string}`;

export interface Memoria {
  id: string;
  tipo: MemoriaTipo;
  escopo: MemoriaEscopo;
  conteudo: string;
  criadaEm: string;
  validaAte?: string;
}

// ── Eventos agent:* ──

export interface AgentTurnoInicioEvent {
  chatId: string;
  mensagem: string;
  ferramentasDisponiveis: string[];
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

// ── Event names (constantes para evitar typos) ──

export const AGENT_EVENTS = {
  TURNO_INICIO: 'agent:turno-inicio',
  TOOL_CALL: 'agent:tool-call',
  TOOL_RESULT: 'agent:tool-result',
  RESPOSTA_PRONTA: 'agent:resposta-pronta',
  PRECISA_FERRAMENTA: 'agent:precisa-ferramenta',
  ERRO: 'agent:erro',
} as const;

// ── MettriModule (para módulos sem UI, apenas init) ──

export interface MettriModule {
  id: string;
  init: (eventBus: EventBus) => Promise<() => void>;
}
