const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Retorna um "serial de dia" baseado na data local (YYYY-MM-DD),
 * mas calculado em UTC para não sofrer com DST (23h/25h).
 *
 * Metáfora: transforma uma data em "número da página do calendário".
 */
function daySerialLocal(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/**
 * Normaliza para início do dia (00:00) no fuso local.
 * Útil para debug/visualização.
 */
export function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Diferença em dias por calendário (não por horas).
 * Retorna um inteiro, ex.: 21 = "3 semanas atrás", sempre mesmo dia da semana.
 */
export function daysBetweenByCalendar(now: Date, past: Date): number {
  return daySerialLocal(now) - daySerialLocal(past);
}

/**
 * Tipo de relação usado na régua de retomada.
 * Metáfora: "ritmo de visita" do cliente (frequente, pontual, sazonal ou sob medida).
 */
export type RelationType = 'frequente' | 'pontual' | 'sazonal' | 'personalizado';

/**
 * Faixa de dias de inatividade.
 * Metáfora: cada faixa é um "balde" de tempo (ex.: 21–41 dias).
 */
export interface ReguaRange {
  min: number;
  max: number;
}

/**
 * Réguas padrão por tipo de relação.
 * - minDistance: distância mínima entre nossas mensagens para não "apertar demais".
 * - ranges: baldes de inatividade (em dias) usados nos Ciclos de contato.
 */
/**
 * Réguas do espec: faixas em 1x, 2x, 3.5x, 5.5x do tempo base.
 * 4ª faixa fecha em 8x base (fim orgânico do funil; acima disso não entra na régua automática).
 * frequente: base 21 → … [116–168]
 * pontual: base 44 → … [242–352]
 * sazonal: base 74 → … [407–592]
 */
/** Multiplicador do teto da última faixa (mesma família 1× … 5,5× do tempo base). */
export const RETOMAR_LAST_BAND_END_MULTIPLIER = 8;

export const REGUAS: Record<
  Exclude<RelationType, 'personalizado'>,
  { minDistance: number; ranges: ReguaRange[] }
> = {
  frequente: {
    minDistance: 21,
    ranges: [
      { min: 21, max: 41 },
      { min: 42, max: 72 },
      { min: 73, max: 115 },
      { min: 116, max: RETOMAR_LAST_BAND_END_MULTIPLIER * 21 },
    ],
  },
  pontual: {
    minDistance: 44,
    ranges: [
      { min: 44, max: 87 },
      { min: 88, max: 153 },
      { min: 154, max: 241 },
      { min: 242, max: RETOMAR_LAST_BAND_END_MULTIPLIER * 44 },
    ],
  },
  sazonal: {
    minDistance: 74,
    ranges: [
      { min: 74, max: 147 },
      { min: 148, max: 258 },
      { min: 259, max: 406 },
      { min: 407, max: RETOMAR_LAST_BAND_END_MULTIPLIER * 74 },
    ],
  },
};

/**
 * Verifica se um número de dias cai dentro de uma faixa.
 * Metáfora: checar se o número cabe dentro da "caixinha" min–max.
 */
export function isInRange(days: number, range: ReguaRange): boolean {
  return days >= range.min && days <= range.max;
}

/**
 * Gera faixas para um tipo de relação.
 * - Padrão: usa REGUAS pré-definidas.
 * - Personalizado: cria 4 baldes com base no intervalo customizado.
 *
 * Ex.: customInterval = 30 → [30–59], [60–89], [90–119], [120+]
 */
export function getRangesForType(
  type: RelationType,
  customInterval?: number | null
): ReguaRange[] {
  if (type !== 'personalizado') {
    return REGUAS[type].ranges;
  }

  const interval = customInterval ?? 0;
  if (!Number.isFinite(interval) || interval <= 0) {
    // Fallback seguro: usar réguas de "frequente"
    return REGUAS.frequente.ranges;
  }

  // Fórmula espec: 1x, 2x, 3.5x, 5.5x; 4ª faixa até 8x (teto finito).
  const base = interval;
  const m1 = base;
  const m2 = 2 * base;
  const m3 = 3.5 * base;
  const m4 = 5.5 * base;
  const lastMax = RETOMAR_LAST_BAND_END_MULTIPLIER * base;
  return [
    { min: m1, max: Math.floor(m2) - 1 },
    { min: Math.floor(m2), max: Math.floor(m3) - 1 },
    { min: Math.floor(m3), max: Math.floor(m4) - 1 },
    { min: Math.floor(m4), max: Math.floor(lastMax) },
  ];
}

/**
 * Distância mínima entre nossas mensagens para um tipo de relação.
 * Metáfora: "tempo mínimo de respiro" entre contatos.
 */
export function getMinDistanceForType(
  type: RelationType,
  customInterval?: number | null
): number {
  if (type !== 'personalizado') {
    return REGUAS[type].minDistance;
  }

  const interval = customInterval ?? 0;
  if (!Number.isFinite(interval) || interval <= 0) {
    // Fallback para não quebrar: usa distância de "frequente"
    return REGUAS.frequente.minDistance;
  }

  return interval;
}
