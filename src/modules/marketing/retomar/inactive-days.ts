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
