/**
 * AgentLoop - Esqueleto do loop do agente com mock probabilístico.
 *
 * Processa mensagens em um while com decisões mockadas:
 *   - 70% tool_use (chama tool aleatória do registry)
 *   - 20% responder (emite resposta-pronta e retorna)
 *   - 10% preciso_ferramenta (emite precisa-ferramenta e continua)
 *
 * Travas de segurança:
 *   - Máximo 8 ferramentas por turno
 *   - Timeout de 30s por turno
 *   - Detecção de repetição (3x mesma tool consecutiva → interrompe)
 */
import type { AgentTurno, ToolCall } from './types';
import { AGENT_EVENTS } from './types';
import type { ToolRegistry } from './tool-registry';
import type { EventBus } from '../../ui/core/event-bus';

export interface AgentLoopOptions {
  maxTools?: number;
  maxDuracaoMs?: number;
  maxRepeticoes?: number;
}

export class AgentLoop {
  private registry: ToolRegistry;
  private eventBus: EventBus;
  private turno: AgentTurno | null = null;
  private options: Required<AgentLoopOptions>;

  constructor(
    registry: ToolRegistry,
    eventBus: EventBus,
    options?: AgentLoopOptions,
  ) {
    this.registry = registry;
    this.eventBus = eventBus;
    this.options = {
      maxTools: options?.maxTools ?? 8,
      maxDuracaoMs: options?.maxDuracaoMs ?? 30_000,
      maxRepeticoes: options?.maxRepeticoes ?? 3,
    };
  }

  /**
   * Processa uma mensagem recebida em um chat.
   * Executa o loop decisório mockado até responder ou estourar limites.
   */
  async processarMensagem(
    chatId: string,
    mensagem: string,
  ): Promise<void> {
    const ferramentasChamadas: ToolCall[] = [];
    const ferramentasDisponiveis = this.registry
      .listarDisponiveis()
      .map((t) => t.nome);

    // Emite início do turno
    this.eventBus.emit(AGENT_EVENTS.TURNO_INICIO, {
      chatId,
      mensagem,
      ferramentasDisponiveis,
    });

    this.turno = {
      chatId,
      mensagemAtual: mensagem,
      ferramentasChamadas,
      status: 'ativo',
      iniciadoEm: new Date().toISOString(),
    };

    const inicio = Date.now();
    let ferramentasUsadas = 0;
    const ultimaToolRepeticao: { nome: string; count: number } = {
      nome: '',
      count: 0,
    };

    while (ferramentasUsadas < this.options.maxTools) {
      // Verifica timeout
      if (Date.now() - inicio > this.options.maxDuracaoMs) {
        this.turno.status = 'erro';
        this.eventBus.emit(AGENT_EVENTS.ERRO, {
          chatId,
          erro: `Timeout: agente excedeu ${this.options.maxDuracaoMs}ms de processamento`,
          gravidade: 'N2',
        });
        return;
      }

      // MOCK: decide próxima ação
      const decisao = this.mockDecidir();

      if (decisao.tipo === 'responder') {
        this.turno.status = 'dormindo';
        this.eventBus.emit(AGENT_EVENTS.RESPOSTA_PRONTA, {
          chatId,
          texto: `[resposta simulada para: ${mensagem}]`,
          ferramentasChamadas: [...ferramentasChamadas],
        });
        return;
      }

      if (decisao.tipo === 'tool_use' && decisao.nome) {
        // Detecta repetição excessiva
        if (ultimaToolRepeticao.nome === decisao.nome) {
          ultimaToolRepeticao.count++;
          if (ultimaToolRepeticao.count >= this.options.maxRepeticoes) {
            this.turno.status = 'erro';
            this.eventBus.emit(AGENT_EVENTS.ERRO, {
              chatId,
              erro: `Agente repetiu a ferramenta "${decisao.nome}" ${this.options.maxRepeticoes} vezes consecutivas`,
              gravidade: 'N2',
            });
            return;
          }
        } else {
          ultimaToolRepeticao.nome = decisao.nome;
          ultimaToolRepeticao.count = 1;
        }

        const resultado = await this.registry.executar(
          decisao.nome,
          decisao.args ?? {},
        );

        ferramentasChamadas.push({
          nome: decisao.nome,
          argumentos: (decisao.args as Record<string, unknown>) ?? {},
          resultado: resultado.dados,
          duracaoMs: 0,
          erro: resultado.erro,
        });

        ferramentasUsadas++;
        continue;
      }

      if (decisao.tipo === 'preciso_ferramenta') {
        this.eventBus.emit(AGENT_EVENTS.PRECISA_FERRAMENTA, {
          chatId,
          nomeSugerido: decisao.nomeSugerido ?? 'ferramenta_desconhecida',
          descricao: decisao.descricao ?? 'Preciso de uma ferramenta adicional',
          entradaEsperada: {},
          saidaEsperada: {},
          porQuePreciso: decisao.porQuePreciso ?? '',
        });
        // Continua o loop sem incrementar contador de tools
        continue;
      }
    }

    // Estourou limite de ferramentas
    this.turno.status = 'erro';
    this.eventBus.emit(AGENT_EVENTS.ERRO, {
      chatId,
      erro: `Agente excedeu limite de ${this.options.maxTools} ferramentas por turno`,
      gravidade: 'N2',
    });
  }

  /**
   * Mock decisório: 70% tool_use, 20% responder, 10% preciso_ferramenta.
   */
  private mockDecidir():
    | { tipo: 'responder' }
    | { tipo: 'tool_use'; nome: string; args?: unknown }
    | {
        tipo: 'preciso_ferramenta';
        nomeSugerido?: string;
        descricao?: string;
        porQuePreciso?: string;
      } {
    const r = Math.random();

    if (r < 0.7) {
      const tools = this.registry.listarDisponiveis();
      if (tools.length === 0) {
        return { tipo: 'responder' };
      }
      const tool = tools[Math.floor(Math.random() * tools.length)];
      return { tipo: 'tool_use', nome: tool.nome, args: {} };
    }

    if (r < 0.9) {
      return { tipo: 'responder' };
    }

    return {
      tipo: 'preciso_ferramenta',
      nomeSugerido: 'calcular_frete',
      descricao: 'Preciso consultar frete por CEP',
      porQuePreciso: 'O cliente perguntou sobre prazo de entrega',
    };
  }

  /** Retorna o turno atual, se houver */
  getTurno(): AgentTurno | null {
    return this.turno;
  }
}
