import type { AgentTurno } from './types';
import { memoryDB, type MemoriaComFreshness, type MemoriaInput } from '../../storage/memory-db';

/**
 * Estrutura de contexto preparado para injeção no prompt do LLM.
 * Cada array contém descrições textuais das memórias encontradas.
 */
export interface ContextoMemorias {
  cliente: string[];
  licoes: string[];
  negocio: string[];
  referencias: string[];
  /** Freshness warnings acumulados (memórias com >2 dias) */
  freshnessWarnings: string[];
}

/**
 * Orquestrador de memórias acima do MemoryDB.
 * Responsável por buscar, filtrar e estruturar memórias para o contexto do LLM.
 */
export class MemoryStore {
  /**
   * Prepara contexto de memórias para injeção no prompt do LLM.
   *
   * Para cada tipo taxonômico:
   * - `cliente` / `licao`: busca apenas memórias do chatId específico
   * - `negocio` / `referencia`: busca global (sem filtro de chatId)
   *
   * A mensagem do cliente é usada como query para keyword match na descrição.
   *
   * @returns estrutura com arrays de strings (descrições das memórias) + freshness warnings
   */
  async prepararContexto(chatId: string, mensagem: string): Promise<ContextoMemorias> {
    const resultado: ContextoMemorias = {
      cliente: [],
      licoes: [],
      negocio: [],
      referencias: [],
      freshnessWarnings: [],
    };

    if (!chatId || !mensagem) return resultado;

    try {
      // 1. Busca memórias por chatId (cliente + licao)
      const [clienteRecords, licaoRecords] = await Promise.all([
        this.buscarPorTipo(chatId, mensagem, 'cliente', 3),
        this.buscarPorTipo(chatId, mensagem, 'licao', 3),
      ]);

      // 2. Busca memórias globais (negocio + referencia)
      const [negocioRecords, referenciaRecords] = await Promise.all([
        this.buscarPorTipo(null, mensagem, 'negocio', 5),
        this.buscarPorTipo(null, mensagem, 'referencia', 3),
      ]);

      // 3. Popula resultado
      for (const r of clienteRecords) {
        resultado.cliente.push(this.formatarMemoria(r));
        if (r.freshnessWarning) resultado.freshnessWarnings.push(r.freshnessWarning);
      }

      for (const r of licaoRecords) {
        resultado.licoes.push(this.formatarMemoria(r));
        if (r.freshnessWarning) resultado.freshnessWarnings.push(r.freshnessWarning);
      }

      for (const r of negocioRecords) {
        resultado.negocio.push(this.formatarMemoria(r));
        if (r.freshnessWarning) resultado.freshnessWarnings.push(r.freshnessWarning);
      }

      for (const r of referenciaRecords) {
        resultado.referencias.push(this.formatarMemoria(r));
        if (r.freshnessWarning) resultado.freshnessWarnings.push(r.freshnessWarning);
      }

      // Deduplica warnings
      resultado.freshnessWarnings = [...new Set(resultado.freshnessWarnings)];

      return resultado;
    } catch {
      // Degradação graciosa: se IndexedDB falhar, contexto segue sem memórias
      return resultado;
    }
  }

  /**
   * Persiste um turno do AgentLoop como memória tipo `licao`.
   *
   * Só persiste se o turno contiver aprendizados detectáveis:
   * - Correções: se `status` for 'erro'
   * - Confirmações: se houve tool calls bem-sucedidas
   * - Padrões: detectados na mensagem
   *
   * @returns o ID da memória criada, ou null se não houver aprendizado
   */
  async salvarTurno(turno: AgentTurno): Promise<number | null> {
    try {
      const aprendizados = this.extrairAprendizados(turno);
      if (!aprendizados) return null;

      const input: MemoriaInput = {
        tipo: 'licao',
        descricao: aprendizados,
        chatId: turno.chatId,
        dados: {
          mensagemAtual: turno.mensagemAtual,
          ferramentasChamadas: turno.ferramentasChamadas.map(f => ({
            nome: f.nome,
            sucesso: !f.erro,
          })),
        },
      };

      const record = await memoryDB.merge(input);
      return record.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Atualiza o perfil do cliente de forma incremental.
   *
   - Faz merge dos dados fornecidos com o perfil existente (tipo `cliente`).
   * Preserva campos existentes não sobrescritos — apenas adiciona/atualiza os campos informados.
   *
   * @returns true se o perfil foi atualizado com sucesso
   */
  async atualizarPerfil(chatId: string, dados: Record<string, unknown>): Promise<boolean> {
    if (!chatId || Object.keys(dados).length === 0) return false;

    try {
      // Descrição fixa por chatId — o merge usa (tipo+chatId+descricao) como chave composta.
      // Assim, múltiplas chamadas sempre atualizam o MESMO registro (merge incremental).
      const input: MemoriaInput = {
        tipo: 'cliente',
        descricao: `perfil do cliente ${chatId}`,
        chatId,
        dados,
      };

      await memoryDB.merge(input);
      return true;
    } catch {
      return false;
    }
  }

  // ── Helpers privados ──

  private async buscarPorTipo(
    chatId: string | null,
    mensagem: string,
    tipo: 'cliente' | 'licao' | 'negocio' | 'referencia',
    max: number,
  ): Promise<MemoriaComFreshness[]> {
    const searchChatId = (tipo === 'negocio' || tipo === 'referencia') ? null : chatId;
    return await memoryDB.getRelevantes(searchChatId, mensagem, max, tipo);
  }

  private formatarMemoria(r: MemoriaComFreshness): string {
    let texto = r.descricao;
    if (r.freshnessWarning) {
      texto += ` ${r.freshnessWarning}`;
    }
    return texto;
  }

  /**
   * Extrai aprendizado textual de um turno, se houver.
   * Retorna null se nada relevante for detectado.
   */
  private extrairAprendizados(turno: AgentTurno): string | null {
    const partes: string[] = [];

    // Erro → aprendizado de correção
    if (turno.status === 'erro') {
      partes.push('correção aplicada');
    }

    // Tool calls → aprendizado de comportamento
    const toolsComErro = turno.ferramentasChamadas.filter(f => f.erro);
    const toolsSucesso = turno.ferramentasChamadas.filter(f => !f.erro);

    if (toolsSucesso.length > 0) {
      const nomes = toolsSucesso.map(f => f.nome).join(', ');
      partes.push(`ferramentas utilizadas com sucesso: ${nomes}`);
    }

    if (toolsComErro.length > 0) {
      const erros = toolsComErro.map(f => `${f.nome}: ${f.erro}`).join('; ');
      partes.push(`ferramentas com erro: ${erros}`);
    }

    if (partes.length === 0) return null;
    return partes.join(' | ');
  }
}

/** Singleton do MemoryStore */
export const memoryStore = new MemoryStore();
