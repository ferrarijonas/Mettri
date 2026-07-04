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
import type { ContextoMemorias } from './memory-store';
import { memoryStore } from './memory-store';
import type { AgentMemoriaSalvaEvent } from './types';
import { getEnvInfo, getToday } from './env-config';

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
      maxTools: options?.maxTools ?? 15,
      maxDuracaoMs: options?.maxDuracaoMs ?? 90_000,
      maxRepeticoes: options?.maxRepeticoes ?? 5,
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
      memorias?: ContextoMemorias;
    },
  ): Promise<void> {
    const ferramentasChamadas: ToolCall[] = [];
    const ferramentasDisponiveis = this.registry
      .listarDisponiveis()
      .map((t) => t.nome);

    // Carrega informações de ambiente
    const envInfo = await getEnvInfo();
    const today = getToday(envInfo.negocio.timezone);

    // Contexto extra para extração de memórias (passado ao salvarEAprender)
    const memoriaExtraContext = {
      profile: context?.profile,
      historicoContexto: context?.historicoContexto,
      envInfo: { businessName: envInfo.negocio.businessName },
      today,
    };

    // Conta memórias carregadas para o evento
    const totalMemorias = context?.memorias
      ? context.memorias.cliente.length
        + context.memorias.licoes.length
        + context.memorias.negocio.length
        + context.memorias.referencias.length
      : 0;

    // Emite início do turno com contexto enriquecido
    this.eventBus.emit(AGENT_EVENTS.TURNO_INICIO, {
      chatId,
      mensagem,
      ferramentasDisponiveis,
      totalMemoriasCarregadas: totalMemorias,
      envInfo: { businessName: envInfo.negocio.businessName, today },
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
    let errosConsecutivos = 0;

    while (ferramentasUsadas < this.options.maxTools) {
      // Verifica timeout
      if (Date.now() - inicio > this.options.maxDuracaoMs) {
        this.turno.status = 'erro';
        await this.salvarEAprender(this.turno, memoriaExtraContext);
        this.eventBus.emit(AGENT_EVENTS.ERRO, {
          chatId,
          erro: `Timeout: agente excedeu ${this.options.maxDuracaoMs}ms de processamento`,
          gravidade: 'N2',
        });
        return;
      }

      // CHAMADA REAL ao DeepSeek com function calling
      const ferramentas = this.registry.listarDisponiveis();
      const toolsDescriptions = ferramentas.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.nome,
          description: t.descricao,
          parameters: zodTypeToJsonSchema(t.inputSchema),
        },
      }));
      const toolInfos = ferramentas.map((t) => ({
        nome: t.nome,
        descricao: t.descricao,
        categoria: t.categoria,
      }));

      const decisao = await agenteDecidir({
        mensagem,
        chatId,
        tools: toolsDescriptions,
        toolInfos,
        toolResults: ferramentasChamadas,
        profile: context?.profile as never,
        catalogoCandidatos: context?.catalogoCandidatos,
        estadoPercebido: context?.estadoPercebido as never,
        historicoContexto: context?.historicoContexto as never,
        memorias: context?.memorias,
        envInfo,
        today,
      });

      // ── Processar decisão ──

      if (decisao.tipo === 'responder') {
        if (!decisao.texto) {
          this.turno.status = 'erro';
          await this.salvarEAprender(this.turno, memoriaExtraContext);
          this.eventBus.emit(AGENT_EVENTS.ERRO, {
            chatId,
            erro: decisao.erro || 'Agente retornou resposta vazia',
            gravidade: 'N3',
          });
          return;
        }
        this.turno.status = 'dormindo';
        await this.salvarEAprender(this.turno, memoriaExtraContext);
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
            await this.salvarEAprender(this.turno, memoriaExtraContext);
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

        // Stuck detector: 3 erros consecutivos (qualquer tool) → fallback
        if (resultado.erro) {
          errosConsecutivos++;
          if (errosConsecutivos >= 3) {
            this.turno.status = 'dormindo';
            await this.salvarEAprender(this.turno, memoriaExtraContext);
            this.eventBus.emit(AGENT_EVENTS.RESPOSTA_PRONTA, {
              chatId,
              texto: `Puxa, estou tendo dificuldade para processar isso agora. Vou passar para um atendente humano que pode ajudar melhor.`,
              ferramentasChamadas: [...ferramentasChamadas],
            });
            return;
          }
        } else {
          errosConsecutivos = 0;
        }

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
    await this.salvarEAprender(this.turno, memoriaExtraContext);
    this.eventBus.emit(AGENT_EVENTS.ERRO, {
      chatId,
      erro: `Agente excedeu limite de ${this.options.maxTools} ferramentas por turno`,
      gravidade: 'N2',
    });
  }

  /**
   * Tenta salvar o turno como aprendizado e emite evento se persisted.
   * Fire-and-forget: erros são capturados — nunca trava o fluxo de resposta.
   */
  /**
   * Tenta determinar se um turno gerou aprendizado global ou por cliente.
   * Espelha a lógica de MemoryStore.salvarTurno para o evento.
   */
  private detectarTipoMemoria(turno: AgentTurno): 'licao' | 'negocio' {
    const mensagem = (turno.mensagemAtual || '').toLowerCase();
    const temPreferencia = /gosto\s+(mais|muito)\s+de|prefiro|não\s+gosto\s+de|odeio/i.test(mensagem);
    return temPreferencia ? 'licao' : 'negocio';
  }

  private async salvarEAprender(
    turno: AgentTurno,
    extraContext?: {
      profile?: unknown;
      historicoContexto?: { papel: string; texto: string }[];
      envInfo?: { businessName: string };
      today?: string;
    },
  ): Promise<void> {
    try {
      const memoriaId = await memoryStore.salvarTurno(turno, extraContext);
      if (memoriaId !== null) {
        this.eventBus.emit(AGENT_EVENTS.MEMORIA_SALVA, {
          chatId: turno.chatId,
          memoriaId,
          tipo: this.detectarTipoMemoria(turno),
          descricao: turno.status === 'erro'
            ? `correção: ${turno.ferramentasChamadas.filter(f => f.erro).map(f => f.nome).join(', ') || 'turno com erro'}`
            : `sucesso: ${turno.ferramentasChamadas.filter(f => !f.erro).map(f => f.nome).join(', ') || 'resposta direta'}`,
          ferramentasUsadas: turno.ferramentasChamadas.map(f => f.nome),
          totalFerramentas: turno.ferramentasChamadas.length,
          status: turno.status,
          duracaoMs: Date.now() - new Date(turno.iniciadoEm).getTime(),
        } satisfies AgentMemoriaSalvaEvent);
      }
    } catch {
      // Degradação graciosa — falha ao salvar não interrompe o fluxo
    }
  }

  /** Retorna o turno atual, se houver */
  getTurno(): AgentTurno | null {
    return this.turno;
  }
}
