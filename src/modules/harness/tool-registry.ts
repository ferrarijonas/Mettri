/**
 * ToolRegistry - Cadastro central de ferramentas do Agent Harness
 *
 * Mantém um Map de Tools, valida argumentos via Zod antes de executar,
 * calcula duração de cada execução e emite eventos agent:tool-call e agent:tool-result.
 */
import type { Tool, ToolResultado } from './types';
import { AGENT_EVENTS } from './types';
import type { EventBus } from '../../ui/core/event-bus';

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Registra uma nova ferramenta.
   * Valida nome duplicado e inputSchema Zod.
   */
  registrar(tool: Tool): void {
    if (this.tools.has(tool.nome)) {
      throw new Error(`Ferramenta "${tool.nome}" já está registrada.`);
    }

    if (!tool.inputSchema || typeof tool.inputSchema.safeParse !== 'function') {
      throw new Error(
        `Ferramenta "${tool.nome}" não possui inputSchema Zod válido.`
      );
    }

    this.tools.set(tool.nome, tool);
  }

  /**
   * Executa uma ferramenta pelo nome, validando argumentos com Zod.
   * Emite agent:tool-call no início e agent:tool-result ao fim.
   */
  async executar(nome: string, args: unknown): Promise<ToolResultado> {
    const tool = this.tools.get(nome);
    if (!tool) {
      const erro: ToolResultado = {
        sucesso: false,
        erro: `Ferramenta "${nome}" não encontrada no registry.`,
      };
      this.eventBus.emit(AGENT_EVENTS.TOOL_RESULT, {
        chatId: '_system_',
        nome,
        resultado: erro,
      });
      return erro;
    }

    // Valida argumentos com Zod
    const parsed = tool.inputSchema.safeParse(args);
    if (!parsed.success) {
      const erroZod = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      const resultado: ToolResultado = {
        sucesso: false,
        erro: `Argumentos inválidos para "${nome}": ${erroZod}`,
      };
      this.eventBus.emit(AGENT_EVENTS.TOOL_RESULT, {
        chatId: '_system_',
        nome,
        resultado,
      });
      return resultado;
    }

    const inicio = performance.now();

    // Emite agent:tool-call com duração 0 (ainda executando)
    this.eventBus.emit(AGENT_EVENTS.TOOL_CALL, {
      chatId: '_system_',
      nome,
      argumentos: parsed.data as Record<string, unknown>,
      duracaoMs: 0,
    });

    try {
      const resultado = await tool.executar(parsed.data);
      const duracaoMs = performance.now() - inicio;

      // Re-emite tool-call com duração real
      this.eventBus.emit(AGENT_EVENTS.TOOL_CALL, {
        chatId: '_system_',
        nome,
        argumentos: parsed.data as Record<string, unknown>,
        duracaoMs,
      });

      this.eventBus.emit(AGENT_EVENTS.TOOL_RESULT, {
        chatId: '_system_',
        nome,
        resultado,
      });

      return resultado;
    } catch (err) {
      const duracaoMs = performance.now() - inicio;
      const resultado: ToolResultado = {
        sucesso: false,
        erro: err instanceof Error ? err.message : String(err),
      };

      this.eventBus.emit(AGENT_EVENTS.TOOL_CALL, {
        chatId: '_system_',
        nome,
        argumentos: parsed.data as Record<string, unknown>,
        duracaoMs,
      });

      this.eventBus.emit(AGENT_EVENTS.TOOL_RESULT, {
        chatId: '_system_',
        nome,
        resultado,
      });

      return resultado;
    }
  }

  /**
   * Retorna lista de todas as ferramentas disponíveis.
   */
  listarDisponiveis(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Busca ferramenta por nome.
   */
  get(nome: string): Tool | undefined {
    return this.tools.get(nome);
  }
}
