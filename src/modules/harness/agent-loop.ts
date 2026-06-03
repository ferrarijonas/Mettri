/**
 * AgentLoop - Loop do agente com decisão via DeepSeek (function calling).
 *
 * Processa mensagens em um while consultando o LLM a cada iteração:
 *   - Chama DeepSeek com as ferramentas disponíveis
 *   - LLM decide: tool_use, responder ou preciso_ferramenta
 *   - Executa a tool escolhida e repete até o LLM decidir responder
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
import { agenteDecidir, zodTypeToJsonSchema } from '../ouvir/motor-llm';

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
   * Executa o loop decisório com DeepSeek até responder ou estourar limites.
   *
   * @param context - Contexto enriquecido do ouvinte (profile, catálogo, estado, histórico)
   */
  async processarMensagem(
    chatId: string,
    mensagem: string,
    context?: {
      profile?: unknown;
      catalogoCandidatos?: string[];
      estadoPercebido?: unknown;
      historicoContexto?: { papel: string; texto: string }[];
    },
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

      // CHAMADA REAL ao DeepSeek com function calling
      const toolsDescriptions = this.registry.listarDisponiveis().map((t) => ({
        type: 'function' as const,
        function: {
          name: t.nome,
          description: t.descricao,
          parameters: zodTypeToJsonSchema(t.inputSchema),
        },
      }));

      const decisao = await agenteDecidir({
        mensagem,
        chatId,
        tools: toolsDescriptions,
        toolResults: ferramentasChamadas,
        profile: context?.profile as never,
        catalogoCandidatos: context?.catalogoCandidatos,
        estadoPercebido: context?.estadoPercebido as never,
        historicoContexto: context?.historicoContexto as never,
      });

      // ── Processar decisão ──

      if (decisao.tipo === 'responder') {
        if (!decisao.texto) {
          // LLM respondeu vazio — provável erro/fallback, encerra
          this.turno.status = 'erro';
          this.eventBus.emit(AGENT_EVENTS.ERRO, {
            chatId,
            erro:
              'Agente retornou resposta vazia — possível erro de comunicação com DeepSeek',
            gravidade: 'N3',
          });
          return;
        }
        this.turno.status = 'dormindo';
        this.eventBus.emit(AGENT_EVENTS.RESPOSTA_PRONTA, {
          chatId,
          texto: decisao.texto,
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

        const inicioTool = Date.now();
        this.eventBus.emit(AGENT_EVENTS.TOOL_CALL, {
          chatId,
          nome: decisao.nome,
          argumentos: decisao.argumentos,
          duracaoMs: 0,
        });

        const resultado = await this.registry.executar(
          decisao.nome,
          decisao.argumentos,
        );

        const duracaoTool = Date.now() - inicioTool;

        this.eventBus.emit(AGENT_EVENTS.TOOL_RESULT, {
          chatId,
          nome: decisao.nome,
          resultado,
        });

        ferramentasChamadas.push({
          nome: decisao.nome,
          argumentos: decisao.argumentos,
          resultado: resultado.dados,
          duracaoMs: duracaoTool,
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
          entradaEsperada: decisao.entradaEsperada ?? {},
          saidaEsperada: decisao.saidaEsperada ?? {},
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

  /** Retorna o turno atual, se houver */
  getTurno(): AgentTurno | null {
    return this.turno;
  }
}
