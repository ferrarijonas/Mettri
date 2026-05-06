import {
  customerProfileDB,
  type CustomerOperationalProfile,
} from '../../../storage/customer-profile-db';
import {
  type CadastroClienteResult,
  type CustomerOperationalSignals,
} from './types';

export const CUSTOMER_OPERATIONAL_PROFILE_MODEL_VERSION = 'cadastro-operacional-v1';

export interface AtualizarPerfilOperacionalClienteInput {
  chatId: string;
  sinais: CustomerOperationalSignals;
}

export interface AtualizarPerfilOperacionalClienteDeps {
  getByChatId(chatId: string): Promise<CustomerOperationalProfile | null>;
  save(profile: CustomerOperationalProfile): Promise<void>;
  clock: { nowIso(): string };
}

const defaultDeps: AtualizarPerfilOperacionalClienteDeps = {
  getByChatId: chatId => customerProfileDB.getByChatId(chatId),
  save: profile => customerProfileDB.upsert(profile),
  clock: { nowIso: () => new Date().toISOString() },
};

function normalizeText(value: string): string {
  return String(value || '').trim();
}

function normalizeList(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  const normalized = Array.from(
    new Set(values.map(value => normalizeText(value)).filter(value => value.length > 0))
  );
  return normalized.length > 0 ? normalized : undefined;
}

/** Faz merge (união) de novas preferências com as existentes, deduplicando. */
function mergeList(novas: string[] | undefined, existentes: string[] | undefined): string[] | undefined {
  const normNovas = normalizeList(novas);
  const normExistentes = existentes ?? [];
  if (!normNovas || normNovas.length === 0) return normExistentes.length > 0 ? normExistentes : undefined;
  const merged = [...new Set([...normExistentes, ...normNovas])];
  return merged.length > 0 ? merged : undefined;
}

function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Mapa de variações ortográficas comuns em produtos de padaria/alimentício. */
const VARIACOES_PRODUTO: Record<string, string> = {
  abobra: 'abobora',
  'pao': 'pao',
  'paes': 'pao',
  integral: 'integral',
  multigraos: 'multigraos',
  multigrão: 'multigraos',
}

/** Normaliza nome de produto pra comparação fuzzy: remove acentos, plurais, variações. */
function normalizarProduto(nome: string): string {
  let n = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\(\)\d]+/g, '') // remove (2x), etc
    .replace(/s$/, '')          // singulariza
    .trim()
  n = VARIACOES_PRODUTO[n] ?? n
  return n
}

/** Extrai quantidade de uma string "produto (Nx)" */
function extrairQtd(rotulo: string): { nome: string; qtd: number | null } {
  const m = rotulo.match(/^(.+?)\s*\((\d+)x\)\s*$/i)
  if (m) return { nome: m[1].trim(), qtd: parseInt(m[2], 10) }
  return { nome: rotulo.trim(), qtd: null }
}

/** Detecta se há conflito entre um produto novo e um existente (mesmo produto, qtd diferente). */
function detectarConflitoProduto(
  novos: string[] | undefined,
  existentes: string[] | undefined,
): Array<{ produto: string; atual: string; proposto: string; evidencia: string }> {
  if (!novos || novos.length === 0 || !existentes || existentes.length === 0) return []

  const conflitos: Array<{ produto: string; atual: string; proposto: string; evidencia: string }> = []

  // Indexa existentes por nome normalizado
  const indexExistentes = new Map<string, string>()
  for (const e of existentes) {
    const { nome, qtd } = extrairQtd(e)
    const key = normalizarProduto(nome)
    if (!indexExistentes.has(key)) indexExistentes.set(key, e)
  }

  for (const n of novos) {
    const { nome: nomeNovo, qtd: qtdNova } = extrairQtd(n)
    const key = normalizarProduto(nomeNovo)
    const existente = indexExistentes.get(key)
    if (!existente) continue // produto novo, sem conflito

    const { nome: _, qtd: qtdExistente } = extrairQtd(existente)
    if (qtdNova !== null && qtdExistente !== null && qtdNova !== qtdExistente) {
      conflitos.push({
        produto: nomeNovo,
        atual: existente,
        proposto: n,
        evidencia: `mesmo produto com quantidade diferente: ${existente} → ${n}`,
      })
    }
  }

  return conflitos
}

function buildConfidence(sinais: CustomerOperationalSignals): number {
  const scoreParts: number[] = [];
  if (typeof sinais.frequenciaContato7d === 'number') scoreParts.push(0.2);
  if (typeof sinais.compras90d === 'number') scoreParts.push(0.2);
  if (sinais.diasDesdeUltimaCompra !== undefined) scoreParts.push(0.2);
  if (Array.isArray(sinais.segmentos) && sinais.segmentos.length > 0) scoreParts.push(0.2);
  if (Array.isArray(sinais.preferenciasProduto) && sinais.preferenciasProduto.length > 0) scoreParts.push(0.1);
  if (Array.isArray(sinais.preferenciasLogistica) && sinais.preferenciasLogistica.length > 0) scoreParts.push(0.1);
  if (typeof sinais.proximidadeScore === 'number') scoreParts.push(0.1);
  return clampConfidence(scoreParts.reduce((acc, item) => acc + item, 0));
}

export async function atualizarPerfilOperacionalCliente(
  input: AtualizarPerfilOperacionalClienteInput,
  deps: AtualizarPerfilOperacionalClienteDeps = defaultDeps
): Promise<CadastroClienteResult<{ chatId: string; confiancaPerfil: number; modelVersion: string }>> {
  const chatId = normalizeText(input.chatId);
  if (!chatId) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'chatId é obrigatório.' };
  }

  if (!input.sinais || typeof input.sinais !== 'object') {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'sinais inválidos.' };
  }

  const frequenciaContato7d = input.sinais.frequenciaContato7d;
  const compras90d = input.sinais.compras90d;
  const diasDesdeUltimaCompra = input.sinais.diasDesdeUltimaCompra;

  if (frequenciaContato7d !== undefined && (!Number.isFinite(frequenciaContato7d) || frequenciaContato7d < 0)) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'frequenciaContato7d inválida.' };
  }
  if (compras90d !== undefined && (!Number.isFinite(compras90d) || compras90d < 0)) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'compras90d inválida.' };
  }
  if (
    diasDesdeUltimaCompra !== undefined &&
    diasDesdeUltimaCompra !== null &&
    (!Number.isFinite(diasDesdeUltimaCompra) || diasDesdeUltimaCompra < 0)
  ) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'diasDesdeUltimaCompra inválido.' };
  }

  const proximidadeScore = input.sinais.proximidadeScore;
  if (proximidadeScore !== undefined && (!Number.isFinite(proximidadeScore) || proximidadeScore < 0 || proximidadeScore > 1)) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'proximidadeScore deve estar em [0..1].' };
  }

  const proximidadeBand = input.sinais.proximidadeBand;
  if (
    proximidadeBand !== undefined &&
    !['frio', 'morno', 'quente'].includes(proximidadeBand)
  ) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'proximidadeBand deve ser frio, morno ou quente.' };
  }

  try {
    const current = await deps.getByChatId(chatId);
    const nowIso = deps.clock.nowIso();
    const segmentos = normalizeList(input.sinais.segmentos) ?? current?.segmentos ?? [];

    // Detecta conflitos em preferenciasProduto antes de fazer merge
    const conflitos = detectarConflitoProduto(
      input.sinais.preferenciasProduto,
      current?.preferenciasProduto,
    )
    const conflitoProdutos = new Set(conflitos.map(c => normalizarProduto(c.produto)))

    // Filtra produtos conflitantes do merge (mantém o existente, proposto vai pra pendência)
    const produtosSemConflito = (input.sinais.preferenciasProduto ?? []).filter(
      p => !conflitoProdutos.has(normalizarProduto(extrairQtd(p).nome)),
    )
    const preferenciasProduto = mergeList(produtosSemConflito, current?.preferenciasProduto);
    const preferenciasLogistica =
      normalizeList(input.sinais.preferenciasLogistica) ?? current?.preferenciasLogistica;
    const confiancaPerfil = buildConfidence(input.sinais);

    const proximidade = (() => {
      if (
        input.sinais.proximidadeScore === undefined &&
        !input.sinais.proximidadeBand &&
        !input.sinais.lastRecomputeReason &&
        !input.sinais.lastRecomputeAtIso &&
        !current?.proximidade
      ) {
        return undefined;
      }
      return {
        score: input.sinais.proximidadeScore ?? current?.proximidade?.score,
        banda: input.sinais.proximidadeBand ?? current?.proximidade?.banda,
        lastRecomputeReason:
          input.sinais.lastRecomputeReason ?? current?.proximidade?.lastRecomputeReason,
        lastRecomputeAtIso: input.sinais.lastRecomputeAtIso ?? current?.proximidade?.lastRecomputeAtIso,
      };
    })();

    // Cria pendências de confirmação para conflitos detectados
    const novasPendencias = conflitos.map(c => ({
      campo: 'preferenciasProduto',
      produto: c.produto,
      atual: c.atual,
      proposto: c.proposto,
      evidencias: [c.evidencia],
      confianca: confiancaPerfil,
      criadoEm: nowIso,
    }))

    // Preserva pendências anteriores não resolvidas + adiciona novas
    const pendenciasExistentes = (current?.pendentesConfirmacao ?? []).filter(
      p => !novasPendencias.some(n => n.produto === p.produto && n.campo === p.campo),
    )
    const pendentesConfirmacao = [...pendenciasExistentes, ...novasPendencias]

    const profile: CustomerOperationalProfile = {
      chatId,
      segmentos,
      confiancaPerfil,
      pendentesConfirmacao: pendentesConfirmacao.length > 0 ? pendentesConfirmacao : undefined,
      nomeConfiavel: normalizeText(input.sinais.nomeConfiavel ?? current?.nomeConfiavel ?? '') || undefined,
      cadastroUtil: input.sinais.cadastroUtil ?? current?.cadastroUtil,
      comportamento: {
        frequenciaContato7d: frequenciaContato7d ?? current?.comportamento?.frequenciaContato7d,
        janelaAtiva: input.sinais.janelaAtiva ?? current?.comportamento?.janelaAtiva,
      },
      historico: {
        diasDesdeUltimaCompra:
          diasDesdeUltimaCompra !== undefined
            ? diasDesdeUltimaCompra
            : (current?.historico?.diasDesdeUltimaCompra ?? null),
        compras90d: compras90d ?? current?.historico?.compras90d,
        ticketMedioFaixa: current?.historico?.ticketMedioFaixa,
      },
      preferenciasProduto,
      preferenciasLogistica,
      sensibilidadeOferta: input.sinais.sensibilidadeOferta ?? current?.sensibilidadeOferta,
      aversoesProduto: normalizeList(input.sinais.aversoesProduto) ?? current?.aversoesProduto,
      formaPagamentoPreferida: normalizeList(input.sinais.formaPagamentoPreferida) ?? current?.formaPagamentoPreferida,
      observacoesLogisticas: normalizeList(input.sinais.observacoesLogisticas) ?? current?.observacoesLogisticas,
      enderecoEntrega: normalizeText(input.sinais.enderecoEntrega ?? current?.enderecoEntrega ?? '') || undefined,
      proximidade: proximidade as CustomerOperationalProfile['proximidade'],
      updatedAtIso: nowIso,
      modelVersion: CUSTOMER_OPERATIONAL_PROFILE_MODEL_VERSION,
    };

    await deps.save(profile);

    return {
      ok: true,
      data: {
        chatId,
        confiancaPerfil,
        modelVersion: CUSTOMER_OPERATIONAL_PROFILE_MODEL_VERSION,
      },
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: 'STORE_ERROR',
      message: error instanceof Error ? error.message : 'Falha ao atualizar perfil operacional.',
    };
  }
}
