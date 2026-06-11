import type { AgentTurno } from './types';
import { memoryDB, type MemoriaComFreshness, type MemoriaInput } from '../../storage/memory-db';
import { extrairMemoriasLLM } from './extrator-memorias';
import type { SalvarTurnoContexto } from './extrator-memorias';

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
   * Persiste turno como memórias, usando LLM extraction primeiro.
   *
   * Tenta extrair memórias com DeepSeek (4 taxonomias + escopo).
   * Se falhar (sem API key, timeout), cai no fallback regex.
   *
   * @returns ID da primeira memória salva, ou null
   */
  async salvarTurno(turno: AgentTurno, contexto?: SalvarTurnoContexto): Promise<number | null> {
    try {
      // Tenta LLM first
      const memorias = await extrairMemoriasLLM({
        turno,
        profile: contexto?.profile,
        historicoContexto: contexto?.historicoContexto,
        envInfo: contexto?.envInfo,
        today: contexto?.today,
      });

      if (memorias.length > 0) {
        let primeiroId: number | null = null;
        for (const m of memorias) {
          const input: MemoriaInput = {
            tipo: m.tipo,
            descricao: m.descricao,
            chatId: m.escopo === 'cliente' ? turno.chatId : undefined,
            dados: {
              ...(m.dados ?? {}),
              origemTurno: turno.chatId,
              ferramentas: turno.ferramentasChamadas.map(f => f.nome),
            },
          };
          const record = await memoryDB.merge(input);
          if (primeiroId === null) primeiroId = record.id ?? null;
        }
        return primeiroId;
      }

      // Fallback: regex
      return await this.salvarTurnoFallback(turno);
    } catch {
      // Degradação total — nem LLM nem fallback funcionaram
      try { return await this.salvarTurnoFallback(turno); } catch { return null; }
    }
  }

  /**
   * Fallback regex para quando LLM não está disponível.
   */
  private async salvarTurnoFallback(turno: AgentTurno): Promise<number | null> {
    const aprendizados = this.extrairAprendizados(turno);
    if (!aprendizados) return null;

    const temPreferencia = this.extrairPreferencias(turno.mensagemAtual).length > 0;
    const ehGlobal = !temPreferencia;

    const input: MemoriaInput = {
      tipo: ehGlobal ? 'negocio' : 'licao',
      descricao: aprendizados,
      chatId: ehGlobal ? undefined : turno.chatId,
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

    // 1. Erro → aprendizado de correção
    if (turno.status === 'erro') {
      const toolsComErro = turno.ferramentasChamadas.filter(f => f.erro);
      if (toolsComErro.length > 0) {
        partes.push(`correção aplicada em: ${toolsComErro.map(f => f.nome).join(', ')}`);
      } else {
        partes.push('turno encerrado com erro');
      }
    }

    // 2. Tools usadas com sucesso
    const toolsSucesso = turno.ferramentasChamadas.filter(f => !f.erro);
    if (toolsSucesso.length > 0) {
      const nomes = toolsSucesso.map(f => f.nome).join(', ');
      partes.push(`ferramentas utilizadas com sucesso: ${nomes}`);
    }

    // 3. Tools com erro (detalhado)
    const toolsComErro = turno.ferramentasChamadas.filter(f => f.erro);
    if (toolsComErro.length > 0) {
      const erros = toolsComErro.map(f => `${f.nome}: ${f.erro}`).join('; ');
      partes.push(`ferramentas com erro: ${erros}`);
    }

    // 4. Preferências detectadas na mensagem do cliente
    const preferencias = this.extrairPreferencias(turno.mensagemAtual);
    if (preferencias.length > 0) {
      partes.push(`preferências detectadas: ${preferencias.join('; ')}`);
    }

    // 5. Duração como métrica de saúde
    const inicio = new Date(turno.iniciadoEm).getTime();
    const duracao = Date.now() - inicio;
    if (duracao > 20000) {
      partes.push(`turno longo (${Math.round(duracao / 1000)}s) — revisar`);
    }

    if (partes.length === 0) return null;
    return partes.join(' | ');
  }

  /**
   * Detecta preferências explícitas do cliente na mensagem.
   * Usa padrões regex simples — sem NLP. Melhorável com uso real.
   */
  private extrairPreferencias(mensagem: string): string[] {
    const preferencias: string[] = [];
    const patterns = [
      /gosto\s+(mais|muito)\s+de\s+([^,.]+)/i,
      /prefiro\s+([^,.]+)/i,
      /não\s+gosto\s+de\s+([^,.]+)/i,
      /odeio\s+([^,.]+)/i,
    ];
    for (const pattern of patterns) {
      const match = mensagem.match(pattern);
      if (match) {
        preferencias.push(match[0].trim().toLowerCase());
      }
    }
    return preferencias;
  }
}

/** Singleton do MemoryStore */
export const memoryStore = new MemoryStore();
